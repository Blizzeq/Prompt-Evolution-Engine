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
          <TrendingUp className="h-4 w-4" />
          Fitness Over Generations
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
            <XAxis
              dataKey="generation"
              tick={{ fontSize: 12 }}
              tickFormatter={(v) => `Gen ${v}`}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12 }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
                padding: "8px 12px",
              }}
              formatter={(value) => [`${value}%`]}
            />
            <Legend
              wrapperStyle={{ fontSize: "12px" }}
            />
            <Line
              type="monotone"
              dataKey="Best"
              stroke="#22c55e"
              strokeWidth={2.5}
              dot={{ r: 5, fill: "#22c55e", strokeWidth: 0 }}
              activeDot={{ r: 7, fill: "#22c55e" }}
            />
            <Line
              type="monotone"
              dataKey="Mean"
              stroke="#3b82f6"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
            />
            <Line
              type="monotone"
              dataKey="Worst"
              stroke="#ef4444"
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={{ r: 2, fill: "#ef4444", strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
