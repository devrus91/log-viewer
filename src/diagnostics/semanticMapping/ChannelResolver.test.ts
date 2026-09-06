import { describe, expect, it } from "vitest";
import { parseCsv } from "@/data/csv";
import { resolveChannels } from "./ChannelResolver";

function channels(header: string) {
  return parseCsv(`${header}\n${header.split(",").map(() => "1").join(",")}\n${header.split(",").map(() => "2").join(",")}`).channels;
}

describe("semantic channel resolver", () => {
  it("selects the strongest candidate independently of CSV column order", () => {
    for (const header of [
      "Boost Pressure Error (bar),Boost Pressure Pre Throttle (filtered) (bar)",
      "Boost Pressure Pre Throttle (filtered) (bar),Boost Pressure Error (bar)",
    ]) {
      const resolved = resolveChannels(channels(header));
      expect(resolved.mapping.get("boost.actual")?.channelName).toBe("Boost Pressure Pre Throttle (filtered) (bar)");
    }
  });

  it("prefers exact torque semantics and ignores a categorical limit reason", () => {
    const resolved = resolveChannels(channels("Torque Desired Max (Nm),Torque Limit Reason (DigitalParameter),Torque Request (Nm)"));
    expect(resolved.mapping.get("torque.request")?.channelName).toBe("Torque Request (Nm)");
    expect(resolved.mapping.get("torque.limit")?.channelName).toBe("Torque Desired Max (Nm)");
  });

  it("gives persisted manual mappings priority over automatic candidates", () => {
    const source = channels("Boost Pressure Error (bar),Boost Pressure Pre Throttle (filtered) (bar)");
    const resolved = resolveChannels(source, [{ canonical: "boost.actual", channelName: "Boost Pressure Error (bar)", updatedAt: 1 }]);
    expect(resolved.mapping.get("boost.actual")).toMatchObject({ channelName: "Boost Pressure Error (bar)", confidence: 1, source: "manual" });
  });

  it("deduplicates automatic group canonicals and allows a manual correction", () => {
    const source = channels("Wheel Speed RL (km/h),Wheel Speed RL (km/h)");
    expect(resolveChannels(source).groups.get("wheel.speed")).toHaveLength(1);
    const corrected = resolveChannels(source, [{ canonical: "wheel.speed.rr", channelName: "Wheel Speed RL (km/h) (2)", updatedAt: 1 }]);
    expect(corrected.groups.get("wheel.speed")?.map((match) => match.canonical)).toEqual(["wheel.speed.rl", "wheel.speed.rr"]);
  });

  it("maps additional ECU Connect channels for future rules", () => {
    const source = channels([
      "Battery voltage Actual (V)", "Flex Fuel Ethanol Content (%)", "Cylinder Fill (%)", "Cylinder Fill Limit (%)",
      "Manifold Pressure Target (bar)", "Mass Airflow Target (Normalised) (kg/h)", "Output Shaft Speed (rpm)", "Converter Lockup Clutch (-)",
    ].join(","));
    const mapping = resolveChannels(source).mapping;

    expect(Object.fromEntries(Array.from(mapping, ([canonical, match]) => [canonical, match.channelName]))).toMatchObject({
      "electrical.batteryVoltage": "Battery voltage Actual (V)",
      "fuel.ethanol": "Flex Fuel Ethanol Content (%)",
      "engine.cylinderFill": "Cylinder Fill (%)",
      "engine.cylinderFillLimit": "Cylinder Fill Limit (%)",
      "boost.manifoldTarget": "Manifold Pressure Target (bar)",
      "air.massFlowTarget": "Mass Airflow Target (Normalised) (kg/h)",
      "transmission.outputShaftRpm": "Output Shaft Speed (rpm)",
      "transmission.tccState": "Converter Lockup Clutch (-)",
    });
  });
});
