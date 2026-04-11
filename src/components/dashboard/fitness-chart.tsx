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
          <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4" />
          Fitness Over Generations
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="generation"
              label={{ value: "Generation", position: "insideBottom", offset: -5 }}
              className="text-xs"
            />
            <YAxis
              domain={[0, 100]}
              label={{ value: "Fitness %", angle: -90, position: "insideLeft" }}
              className="text-xs"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
                fontSize: "12px",
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="Best"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="Mean"
              stroke="hsl(var(--chart-2))"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="Worst"
              stroke="hsl(var(--chart-3))"
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={{ r: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
