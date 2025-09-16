import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RTooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

interface DayRecord {
  date: string; // YYYY-MM-DD
  present: boolean;
  comeIn: string; // 09:10
  comeOut: string; // 17:45
  graceIn: boolean;
  graceOut: boolean;
  leaveType?: "CL" | "EL" | "ML";
}

const COLORS = ["#ef4444", "#fca5a5", "#fecaca", "#991b1b"]; // red shades

function genMonth(year: number, month: number): DayRecord[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const records: DayRecord[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const wd = date.getDay(); // 0=Sun
    const isWeekend = wd === 0 || wd === 6;
    const lateSeed = (d * 7) % 5 === 0;
    const earlySeed = (d * 11) % 7 === 0;
    const leaveSeed = (d * 13) % 29 === 0;

    if (isWeekend) {
      records.push({ date: date.toISOString().slice(0, 10), present: false, comeIn: "-", comeOut: "-", graceIn: false, graceOut: false });
      continue;
    }

    let leaveType: DayRecord["leaveType"] | undefined = undefined;
    if (leaveSeed) leaveType = (d % 3 === 0 ? "CL" : d % 3 === 1 ? "EL" : "ML");

    const present = !leaveType;
    const comeIn = present ? (lateSeed ? "09:20" : "09:00") : "-";
    const comeOut = present ? (earlySeed ? "17:20" : "17:45") : "-";

    records.push({
      date: date.toISOString().slice(0, 10),
      present,
      comeIn,
      comeOut,
      graceIn: present && lateSeed,
      graceOut: present && earlySeed,
      leaveType,
    });
  }
  return records;
}

export default function Attendance() {
  const data = useMemo(() => genMonth(new Date().getFullYear(), new Date().getMonth()), []);

  const monthly = useMemo(() => {
    const present = data.filter((d) => d.present).length;
    const leave = data.filter((d) => !!d.leaveType).length;
    const absent = data.length - present - leave; // weekends considered absent for chart aesthetics
    return { present, leave, absent };
  }, [data]);

  const pieData = [
    { name: "Present", value: monthly.present },
    { name: "Leave", value: monthly.leave },
    { name: "Absent/Off", value: monthly.absent },
  ];

  const graceInCount = data.filter((d) => d.graceIn).length;
  const graceOutCount = data.filter((d) => d.graceOut).length;
  const clFromGrace = Math.floor((graceInCount + graceOutCount) / 4);

  const lineData = data.map((d) => ({ day: d.date.slice(-2), in: d.graceIn ? 1 : 0, out: d.graceOut ? 1 : 0 }));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">My Attendance</h2>
        <p className="text-sm text-muted-foreground">Charts and detailed logs for this month</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Monthly Distribution</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={4}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <RTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Grace In/Out Flow (per day)</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis allowDecimals={false} />
                  <RTooltip />
                  <Legend />
                  <Line type="monotone" dataKey="in" name="Grace In" stroke="#ef4444" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="out" name="Grace Out" stroke="#b91c1c" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Punches (This Month)</p>
            <div className="overflow-auto rounded-md border">
              <table className="min-w-[980px] text-sm">
                <colgroup>
                  <col className="w-[140px]" />
                  <col className="w-[160px]" />
                  <col className="w-[140px]" />
                  <col className="w-[140px]" />
                  <col className="w-[160px]" />
                </colgroup>
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="p-2">Date</th>
                    <th className="p-2">Going In</th>
                    <th className="p-2">Grace In</th>
                    <th className="p-2">Grace Out</th>
                    <th className="p-2">Going Out</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.map((r) => (
                    <tr key={r.date} className="hover:bg-muted/20">
                      <td className="p-2 text-muted-foreground">{r.date}</td>
                      <td className="p-2">{r.comeIn}</td>
                      <td className="p-2">
                        <span className={r.graceIn ? "px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-700 border border-red-200" : "px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground"}>
                          {r.graceIn ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="p-2">
                        <span className={r.graceOut ? "px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-700 border border-red-200" : "px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground"}>
                          {r.graceOut ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="p-2">{r.comeOut}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-4">
            <p className="text-xs text-muted-foreground">Leave Ledger</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center bg-red-50 border-red-200">
                <div className="text-xs text-red-700">Grace In</div>
                <div className="text-2xl font-semibold text-red-700">{graceInCount}</div>
              </div>
              <div className="rounded-lg border p-3 text-center bg-red-50 border-red-200">
                <div className="text-xs text-red-700">Grace Out</div>
                <div className="text-2xl font-semibold text-red-700">{graceOutCount}</div>
              </div>
              <div className="rounded-lg border p-3 text-center bg-red-50 border-red-200">
                <div className="text-xs text-red-700">CL from Grace</div>
                <div className="text-2xl font-semibold text-red-700">{clFromGrace}</div>
              </div>
            </div>
            <div className="overflow-auto rounded-md border">
              <table className="min-w-[560px] text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="p-2">Type</th>
                    <th className="p-2">Count</th>
                    <th className="p-2">Rule</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr className="hover:bg-muted/20">
                    <td className="p-2">
                      <span className="px-2.5 py-0.5 rounded-full text-xs bg-red-100 text-red-700 border border-red-200">CL</span>
                    </td>
                    <td className="p-2 font-semibold">{clFromGrace}</td>
                    <td className="p-2 text-muted-foreground">4 grace in/out = 1 CL</td>
                  </tr>
                  <tr className="hover:bg-muted/20">
                    <td className="p-2">
                      <span className="px-2.5 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 border border-amber-200">EL</span>
                    </td>
                    <td className="p-2 font-semibold">{Math.max(0, Math.floor(monthly.leave / 3) - clFromGrace)}</td>
                    <td className="p-2 text-muted-foreground">Derived</td>
                  </tr>
                  <tr className="hover:bg-muted/20">
                    <td className="p-2">
                      <span className="px-2.5 py-0.5 rounded-full text-xs bg-rose-100 text-rose-800 border border-rose-200">ML</span>
                    </td>
                    <td className="p-2 font-semibold">{Math.max(0, monthly.leave - (Math.max(0, Math.floor(monthly.leave / 3) - clFromGrace)) - clFromGrace)}</td>
                    <td className="p-2 text-muted-foreground">Derived</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
