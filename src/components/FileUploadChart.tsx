"use client";
import React, { useState, useRef } from "react";
import Papa from "papaparse";
import { Line } from "react-chartjs-2";

import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ChartOptions,
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    zoomPlugin
);

import type { ChartDataset } from "chart.js";

export default function FileUploadChart() {
    const [data, setData] = useState<any>(null);
    const [fullLabels, setFullLabels] = useState<string[]>([]);
    // Extend ChartDataset to allow originalData (for tooltips)
    type MyChartDataset = ChartDataset<"line", (number | null)[]> & { originalData?: (number | null)[] };
    const [fullDatasets, setFullDatasets] = useState<MyChartDataset[]>([]);
    const [datasets, setDatasets] = useState<MyChartDataset[]>([]); // Only for legend visibility state
    const [error, setError] = useState<string>("");
    // Range of indices to display (for zoom/select)
    const [range, setRange] = useState<{ start: number, end: number }>({ start: 0, end: 0 });
    const chartRef = useRef<any>(null);


    // Skip lines state
    const [skipLines, setSkipLines] = useState(0);

    // On file load, set fullLabels/fullDatasets, and initialize datasets (for legend visibility)
    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (ext === "csv") {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                beforeFirstChunk: (chunk) => {
                    if (skipLines > 0) {
                        // Remove the first N lines
                        return chunk.split(/\r?\n/).slice(skipLines).join("\n");
                    }
                    return chunk;
                },
                complete: (results) => {
                    if (results.data && results.data.length > 0) {
                        const keys = Object.keys(results.data[0] as Record<string, any>);
                        const xLabels = results.data.map((row: any) => row[keys[0]]);
                        // For each column except the first, create a normalized dataset and preserve original
                        const fullDs: MyChartDataset[] = keys.slice(1).map((key, idx) => {
                            const color = `hsl(${(idx * 360) / keys.length}, 70%, 50%)`;
                            const raw = results.data.map((row: any) => {
                                const val = row[key];
                                const num = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : Number(val);
                                return isNaN(num) ? null : num;
                            });
                            // Normalize to 0-1
                            const nums = raw.filter((v: any) => typeof v === 'number' && v !== null) as number[];
                            const min = Math.min(...nums);
                            const max = Math.max(...nums);
                            const norm = raw.map((v: any) => (typeof v === 'number' && v !== null && max !== min) ? ((v - min) / (max - min)) * 100 : 0);
                            // Only show Engine Speed or Boost by default
                            const show = key.includes('Engine Speed') || key.includes('Boost');
                            return {
                                label: key,
                                data: norm,
                                originalData: raw,
                                borderColor: color,
                                backgroundColor: color + '80',
                                spanGaps: true,
                                hidden: !show,
                            };
                        });
                        setFullLabels(xLabels);
                        setFullDatasets(fullDs);
                        // For legend toggling, keep a separate datasets state (just for hidden prop)
                        setDatasets(fullDs.map(ds => ({ ...ds })));
                        setData(results.data);
                        setRange({ start: 0, end: xLabels.length - 1 });
                        setError("");
                    } else {
                        setError("CSV file is empty or invalid.");
                    }
                },
                error: () => setError("Failed to parse CSV file."),
            });
        } else if (ext === "json") {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    let json = JSON.parse(event.target?.result as string);
                    if (Array.isArray(json) && json.length > 0) {
                        if (skipLines > 0) {
                            json = json.slice(skipLines);
                        }
                        const keys = Object.keys(json[0] as Record<string, any>);
                        const xLabels = json.map((row: any) => row[keys[0]]);
                        const fullDs: MyChartDataset[] = keys.slice(1).map((key, idx) => {
                            const color = `hsl(${(idx * 360) / keys.length}, 70%, 50%)`;
                            const raw = json.map((row: any) => {
                                const val = row[key];
                                const num = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : Number(val);
                                return isNaN(num) ? null : num;
                            });
                            // Normalize to 0-1
                            const nums = raw.filter((v: any) => typeof v === 'number' && v !== null) as number[];
                            const min = Math.min(...nums);
                            const max = Math.max(...nums);
                            const norm = raw.map((v: any) => (typeof v === 'number' && v !== null && max !== min) ? ((v - min) / (max - min)) * 100 : 0);
                            // Only show Engine Speed or Boost by default
                            const show = key.includes('Engine Speed') || key.includes('Boost');
                            return {
                                label: key,
                                data: norm,
                                originalData: raw,
                                borderColor: color,
                                backgroundColor: color + '80',
                                spanGaps: true,
                                hidden: !show,
                            };
                        });
                        setFullLabels(xLabels);
                        setFullDatasets(fullDs);
                        setDatasets(fullDs.map(ds => ({ ...ds })));
                        setData(json);
                        setRange({ start: 0, end: xLabels.length - 1 });
                        setError("");
                    } else {
                        setError("JSON file is empty or invalid.");
                    }
                } catch {
                    setError("Failed to parse JSON file.");
                }
            };
            reader.readAsText(file);
        } else {
            setError("Unsupported file type. Please upload a CSV or JSON file.");
        }
    };



    // Reset zoom handler
    const handleResetZoom = () => {
        if (chartRef.current) {
            chartRef.current.resetZoom && chartRef.current.resetZoom();
            setRange({ start: 0, end: fullLabels.length - 1 });
        }
    };

    // Search bar state for legend filtering
    const [legendSearch, setLegendSearch] = useState("");

    // Always slice from fullLabels/fullDatasets for chart rendering
    const slicedLabels = fullLabels.slice(range.start, range.end + 1);
    // For legend toggling, use datasets[] for hidden prop, but always slice from fullDatasets
    const slicedDatasets = fullDatasets.map((fullDs, idx) => {
        const legendHidden = datasets[idx]?.hidden ?? false;
        return {
            ...fullDs,
            data: fullDs.data.slice(range.start, range.end + 1),
            originalData: fullDs.originalData ? fullDs.originalData.slice(range.start, range.end + 1) : undefined,
            hidden: legendHidden,
        };
    });

    // Filter legend buttons by search
    const filteredLegend = legendSearch.trim().length === 0
        ? datasets
        : datasets.filter(ds => ds.label && ds.label.toLowerCase().includes(legendSearch.trim().toLowerCase()));

    return (
        <div className="w-full py-10">
            <h1 className="text-3xl font-bold mb-6">Upload Car Data Log</h1>
            <div className="flex items-center gap-4 mb-4">
                <label className="font-semibold">Skip lines:</label>
                <input
                    type="number"
                    min={0}
                    value={skipLines}
                    onChange={e => setSkipLines(Math.max(0, Number(e.target.value)))}
                    className="border rounded px-2 py-1 w-24"
                />
                <span className="text-gray-500 text-xs">(Number of lines to skip before parsing)</span>
            </div>
            <input
                type="file"
                accept=".csv,.json"
                onChange={handleFile}
                className="mb-6"
            />
            {error && <div className="text-red-500 mb-4">{error}</div>}
            {fullLabels.length > 0 && fullDatasets.length > 0 && (
                <div className="w-full overflow-x-auto bg-white rounded shadow p-4 mb-8">
                    {/* Legend search bar */}
                    <div className="mb-2 flex items-center gap-2 w-full">
                        <input
                            type="text"
                            value={legendSearch}
                            onChange={e => setLegendSearch(e.target.value)}
                            placeholder="Search labels..."
                            className="border rounded px-2 py-1 w-full max-w-xl text-sm placeholder-gray-700 text-gray-900"
                        />
                        {legendSearch && (
                            <button
                                onClick={() => setLegendSearch("")}
                                className="ml-1 px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300"
                            >Clear</button>
                        )}
                    </div>
                    {/* Custom scrollable legend */}
                    <div className="max-h-40 overflow-y-auto mb-4 border rounded p-2 bg-gray-50 flex flex-wrap gap-2 w-full">
                        {filteredLegend.length === 0 && (
                            <span className="text-gray-400 text-xs">No labels found</span>
                        )}
                        {filteredLegend.map((ds, idx) => {
                            // Find the real index in datasets (for toggling hidden)
                            const realIdx = datasets.findIndex(d => d.label === ds.label);
                            const color = typeof ds.borderColor === 'string' ? ds.borderColor : '#888';
                            return (
                                <button
                                    key={ds.label}
                                    className={`flex items-center gap-2 px-2 py-1 rounded text-xs font-medium border ${ds.hidden ? 'bg-gray-200 text-gray-400' : 'bg-white'} `}
                                    style={{ borderColor: color, color: color }}
                                    onClick={() => setDatasets(dArr => dArr.map((d, i) => i === realIdx ? { ...d, hidden: !d.hidden } : d))}
                                    type="button"
                                >
                                    <span className="inline-block w-3 h-3 rounded-full mr-1" style={{ background: color, opacity: ds.hidden ? 0.3 : 1 }}></span>
                                    {ds.label}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex items-center gap-4 mb-4 w-full flex-wrap">
                        <label className="font-semibold">Start index:</label>
                        <input
                            type="number"
                            min={0}
                            max={fullLabels.length - 1}
                            value={range.start}
                            onChange={e => setRange(r => ({ ...r, start: Math.max(0, Math.min(Number(e.target.value), r.end)) }))}
                            className="border rounded px-2 py-1 w-24"
                        />
                        <label className="font-semibold">End index:</label>
                        <input
                            type="number"
                            min={range.start}
                            max={fullLabels.length - 1}
                            value={range.end}
                            onChange={e => setRange(r => ({ ...r, end: Math.min(fullLabels.length - 1, Math.max(Number(e.target.value), r.start)) }))}
                            className="border rounded px-2 py-1 w-24"
                        />
                        <span className="text-gray-500">(0 to {fullLabels.length - 1})</span>
                        <button onClick={handleResetZoom} className="ml-4 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">Reset Zoom</button>
                        <span className="text-xs text-blue-600">Tip: Ctrl+drag on chart to select index range</span>
                    </div>
                    <div style={{ height: 500, width: '100%', position: 'relative' }} className="w-full">
                        <Line
                            ref={chartRef}
                            data={{
                                labels: slicedLabels,
                                datasets: slicedDatasets,
                            }}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                animation: false,
                                interaction: {
                                    mode: 'index',
                                    intersect: false,
                                },
                                plugins: {
                                    legend: {
                                        display: false,
                                    },
                                    title: { display: true, text: "Car Data Chart" },
                                    zoom: {
                                        pan: {
                                            enabled: true,
                                            mode: 'xy',
                                        },
                                        zoom: {
                                            wheel: {
                                                enabled: true,
                                            },
                                            pinch: {
                                                enabled: true,
                                            },
                                            drag: {
                                                enabled: true,
                                                modifierKey: 'ctrl',
                                            },
                                            mode: 'xy',
                                            onZoom: (ctx) => {
                                                // Only update range if this is a drag-zoom (selection), not wheel/pinch
                                                if (ctx?.trigger === 'drag') {
                                                    const chart = ctx.chart;
                                                    const xScale = chart.scales.x;
                                                    if (xScale && typeof xScale.left === 'number' && typeof xScale.right === 'number') {
                                                        const leftVal = xScale.getValueForPixel(xScale.left);
                                                        const rightVal = xScale.getValueForPixel(xScale.right);
                                                        if (typeof leftVal === 'number' && typeof rightVal === 'number') {
                                                            const minIdx = Math.max(0, Math.round(leftVal));
                                                            const maxIdx = Math.min(fullLabels.length - 1, Math.round(rightVal));
                                                            setRange({ start: Math.min(minIdx, maxIdx), end: Math.max(minIdx, maxIdx) });
                                                            console.log(`Zoomed to range: ${minIdx} - ${maxIdx}`);
                                                        }
                                                    }
                                                }
                                            },
                                        },
                                        limits: {
                                            x: { minRange: 5 },
                                            y: { minRange: 0.1 },
                                        },
                                    },
                                    tooltip: {
                                        callbacks: {
                                            label: function (context) {
                                                // Only show the value for the current dataset if it's visible
                                                const chart = context.chart;
                                                const dsIndex = context.datasetIndex;
                                                const meta = chart.getDatasetMeta(dsIndex);
                                                if (meta.hidden) return null;
                                                const ds = context.dataset as any;
                                                const idx = context.dataIndex;
                                                const orig = ds.originalData && ds.originalData[idx] != null ? ds.originalData[idx] : null;
                                                let label = ds.label || '';
                                                if (orig !== null) {
                                                    label += `: ${orig}`;
                                                }
                                                return label;
                                            }
                                        }
                                    },
                                    decimation: {
                                        enabled: true,
                                        algorithm: 'lttb',
                                        samples: 500,
                                    },
                                },
                                scales: {
                                    x: {
                                        ticks: {
                                            autoSkip: false,
                                            maxRotation: 90,
                                            minRotation: 45,
                                            font: { size: 12 },
                                        },
                                    },
                                    y: {
                                        ticks: {
                                            font: { size: 14 },
                                        },
                                    },
                                },
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
