"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

interface FitnessPoint {
  generation: number;
  best: number;
  mean: number;
  worst: number;
}

interface FitnessChartProps {
  data: FitnessPoint[];
}

export function FitnessChart({ data }: FitnessChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Fitness Over Generations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
            Waiting for first generation...
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    generation: d.generation,
    Best: +(d.best * 100).toFixed(1),
    Mean: +(d.mean * 100).toFixed(1),
    Worst: +(d.worst * 100).toFixed(1),
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
          </div>
          Fitness Over Generations
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="currentColor"
              strokeOpacity={0.08}
              vertical={false}
            />
            <XAxis
              dataKey="generation"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `Gen ${v}`}
              stroke="currentColor"
              strokeOpacity={0.2}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
              stroke="currentColor"
              strokeOpacity={0.2}
              width={45}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: "12px",
                fontSize: "12px",
                padding: "8px 12px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              }}
              formatter={(value) => [`${value}%`]}
            />
            <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
            <Line
              type="monotone"
              dataKey="Best"
              stroke="oklch(0.62 0.17 145)"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "oklch(0.62 0.17 145)", strokeWidth: 0 }}
              activeDot={{ r: 6, fill: "oklch(0.62 0.17 145)" }}
            />
            <Line
              type="monotone"
              dataKey="Mean"
              stroke="oklch(0.62 0.17 52)"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={{ r: 3, fill: "oklch(0.62 0.17 52)", strokeWidth: 0 }}
            />
            <Line
              type="monotone"
              dataKey="Worst"
              stroke="oklch(0.577 0.245 27)"
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={{ r: 2, fill: "oklch(0.577 0.245 27)", strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
