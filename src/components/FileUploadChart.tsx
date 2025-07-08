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
function FileUploadChart() {
    const [fullLabels, setFullLabels] = useState<string[]>([]);
    // Extend ChartDataset to allow originalData (for tooltips)
    type MyChartDataset = ChartDataset<"line", (number | null)[]> & { originalData?: (number | null)[] };
    const [fullDatasets, setFullDatasets] = useState<MyChartDataset[]>([]);
    const [datasets, setDatasets] = useState<MyChartDataset[]>([]); // Only for legend visibility state
    const [error, setError] = useState<string>("");
    // Range of indices to display (for zoom/select)
    const [range, setRange] = useState<{ start: number, end: number }>({ start: 0, end: 0 });
    const chartRef = useRef<ChartJS<"line", (number | null)[]> | null>(null);


    // Type for a row of parsed CSV/JSON
    type DataRow = Record<string, string | number | null | undefined>;

    // On file load, set fullLabels/fullDatasets, and initialize datasets (for legend visibility)
    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (ext === "csv") {
            Papa.parse<DataRow>(file, {
                header: true,
                skipEmptyLines: true,
                beforeFirstChunk: (chunk) => {
                    const lines = chunk.split(/\r?\n/);

                    // Пропускаем все строки с начала, пока они начинаются с #
                    let i = 0;
                    while (i < lines.length && lines[i].trimStart().startsWith("#")) {
                        i++;
                    }

                    // Возвращаем оставшиеся строки, начиная с первой неподходящей
                    return lines.slice(i).join("\n");
                },
                complete: (results) => {
                    const rows = results.data as DataRow[];
                    if (rows && rows.length > 0) {
                        const keys = Object.keys(rows[0]);
                        const xLabels = rows.map((row) => row[keys[0]] as string);
                        // For each column except the first, create a normalized dataset and preserve original
                        const fullDs: MyChartDataset[] = keys.slice(1).map((key, i) => {
                            const color = `hsl(${(i * 360) / keys.length}, 70%, 50%)`;
                            const raw = rows.map((row) => {
                                const val = row[key];
                                const num = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : Number(val);
                                return isNaN(num) ? null : num;
                            });
                            // Normalize to 0-100
                            const nums = raw.filter((v): v is number => typeof v === 'number' && v !== null);
                            const min = Math.min(...nums);
                            const max = Math.max(...nums);
                            const norm = raw.map((v) => (typeof v === 'number' && v !== null && max !== min) ? ((v - min) / (max - min)) * 100 : 0);
                            // Only show Engine Speed or Boost by default
                            const show = key.includes('Engine Speed') || key.includes('rpm') ||key.includes('Boost');
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
                    let json = JSON.parse(event.target?.result as string) as DataRow[];
                    if (Array.isArray(json) && json.length > 0) {
                        const keys = Object.keys(json[0]);
                        const xLabels = json.map((row) => row[keys[0]] as string);
                        const fullDs: MyChartDataset[] = keys.slice(1).map((key, i) => {
                            const color = `hsl(${(i * 360) / keys.length}, 70%, 50%)`;
                            const raw = json.map((row) => {
                                const val = row[key];
                                const num = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : Number(val);
                                return isNaN(num) ? null : num;
                            });
                            // Normalize to 0-100
                            const nums = raw.filter((v): v is number => typeof v === 'number' && v !== null);
                            const min = Math.min(...nums);
                            const max = Math.max(...nums);
                            const norm = raw.map((v) => (typeof v === 'number' && v !== null && max !== min) ? ((v - min) / (max - min)) * 100 : 0);
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
        if (chartRef.current && typeof chartRef.current.resetZoom === 'function') {
            chartRef.current.resetZoom();
            setRange({ start: 0, end: fullLabels.length - 1 });
        }
    };

    // Search bar state for legend filtering
    const [legendSearch, setLegendSearch] = useState("");

    // Always slice from fullLabels/fullDatasets for chart rendering
    const slicedLabels = fullLabels.slice(range.start, range.end + 1);
    // For legend toggling, use datasets[] for hidden prop, but always slice from fullDatasets
    const slicedDatasets = fullDatasets.map((fullDs, i) => {
        const legendHidden = datasets[i]?.hidden ?? false;
        return {
            ...fullDs,
            data: fullDs.data.slice(range.start, range.end + 1),
            originalData: fullDs.originalData ? fullDs.originalData.slice(range.start, range.end + 1) : undefined,
            hidden: legendHidden,
        };
    });

    // Local state for index inputs
    const [startInput, setStartInput] = useState<string>("0");
    const [endInput, setEndInput] = useState<string>("0");

    // Sync input fields with range when data changes
    React.useEffect(() => {
        setStartInput(range.start.toString());
        setEndInput(range.end.toString());
    }, [range.start, range.end]);

    // Filter legend buttons by search
    const filteredLegend = legendSearch.trim().length === 0
        ? datasets
        : datasets.filter(ds => typeof ds.label === 'string' && ds.label.toLowerCase().includes(legendSearch.trim().toLowerCase()));

    return (
        <div className="w-full py-10">
            <h1 className="text-3xl font-bold mb-6">Upload Car Data Log</h1>
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
                        {filteredLegend.map((ds) => {
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
                        <label className="font-semibold placeholder-gray-700 text-gray-900">Start index:</label>
                        <input
                            type="number"
                            min={0}
                            max={fullLabels.length - 1}
                            value={startInput}
                            onChange={e => setStartInput(e.target.value)}
                            onBlur={() => {
                                const val = Number(startInput);
                                setRange(r => ({ ...r, start: Math.max(0, Math.min(isNaN(val) ? 0 : val, r.end)) }));
                            }}
                            className="border rounded px-2 py-1 w-24 placeholder-gray-700 text-gray-900"
                        />
                        <label className="font-semibold placeholder-gray-700 text-gray-900">End index:</label>
                        <input
                            type="number"
                            min={range.start}
                            max={fullLabels.length - 1}
                            value={endInput}
                            onChange={e => setEndInput(e.target.value)}
                            onBlur={() => {
                                const val = Number(endInput);
                                setRange(r => ({ ...r, end: Math.min(fullLabels.length - 1, Math.max(isNaN(val) ? r.start : val, r.start)) }));
                            }}
                            className="border rounded px-2 py-1 w-24 placeholder-gray-700 text-gray-900"
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
                                                            setRange({ start: range.start + Math.min(minIdx, maxIdx), end: range.start + Math.max(minIdx, maxIdx) });
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
                                                if (meta.hidden) return undefined;
                                                const ds = context.dataset as { label?: string; originalData?: (number | null)[] };
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


export default FileUploadChart;