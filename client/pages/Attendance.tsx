import { useMemo } from "react";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RTooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

interface PunchRow {
  cardId: string;
  empId: string;
  name: string;
  inDate: string;
  inTime: string;
  outDate: string;
  outTime: string;
  department: string;
  college: string;
  graceIn: boolean;
  graceOut: boolean;
  lateIn: boolean;
  earlyOut: boolean;
  durationMinutes: number;
}

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
  const [punches, setPunches] = useState<PunchRow[]>([]);
  const data = useMemo(() => genMonth(new Date().getFullYear(), new Date().getMonth()), []);

  useEffect(() => {
    const EXCEL_URL = "https://cdn.builder.io/o/assets%2F0d7360767e284db5a397928f0c050cd5%2Fd844be6c7da449baad542fb249ed37ec?alt=media&token=ada026c9-a509-484f-9643-1fdedfc85007&apiKey=0d7360767e284db5a397928f0c050cd5";
    (async () => {
      try {
        const buf = await fetch(EXCEL_URL).then((r) => {
          if (!r.ok) throw new Error(`Failed to fetch Excel: ${r.status}`);
          return r.arrayBuffer();
        });
        let xlsx: any = null;
        try {
          xlsx = await import("xlsx");
        } catch {
          await new Promise<void>((resolve, reject) => {
            if ((window as any).XLSX) return resolve();
            const s = document.createElement("script");
            s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
            s.onload = () => resolve();
            s.onerror = () => reject(new Error("Failed to load xlsx UMD bundle"));
            document.head.appendChild(s);
          });
          xlsx = (window as any).XLSX;
        }
        const wb = xlsx.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = xlsx.utils.sheet_to_json(sheet, { defval: "" });
        const norm = (s: string) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
        const findKey = (obj: any, regex: RegExp, fallbackKeys: string[] = []) => {
          const keys = Object.keys(obj);
          const found = keys.find((k) => regex.test(k.toLowerCase()));
          if (found) return found;
          return fallbackKeys.find((f) => keys.some((k) => norm(k) === norm(f))) ?? "";
        };
        const parseDate = (v: any): string => {
          if (v instanceof Date) return v.toISOString().slice(0, 10);
          const s = String(v).trim();
          if (!s) return "";
          const d = new Date(s);
          if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
          const m = s.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
          if (m) {
            const [_, dd, mm, yyyy] = m;
            const year = Number(yyyy.length === 2 ? `20${yyyy}` : yyyy);
            const dt = new Date(year, Number(mm) - 1, Number(dd));
            return dt.toISOString().slice(0, 10);
          }
          return "";
        };
        const parseTime = (v: any): string => {
          const s = String(v).trim();
          if (!s) return "";
          const m = s.match(/(\d{1,2}):(\d{2})/);
          if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
          return "";
        };
        const toBool = (v: any): boolean => {
          const s = norm(v);
          if (s === "yes" || s === "y" || s === "true" || s === "1") return true;
          if (s === "no" || s === "n" || s === "false" || s === "0") return false;
          return Boolean(v);
        };

        const mapped: PunchRow[] = rows.map((row) => {
          const cardKey = findKey(row, /card\s*id|card\s*no|card\s*number/);
          const empKey = findKey(row, /employee\s*id|emp\s*id|id$/);
          const nameKey = findKey(row, /employee\s*name|name/);
          const deptKey = findKey(row, /department|dept/);
          const collegeKey = findKey(row, /college|institute|org/);
          const inDateKey = findKey(row, /in\s*date|date\s*in|entry\s*date/);
          const inTimeKey = findKey(row, /in\s*time|time\s*in|entry\s*time/);
          const outDateKey = findKey(row, /out\s*date|date\s*out|exit\s*date/);
          const outTimeKey = findKey(row, /out\s*time|time\s*out|exit\s*time/);
          const graceInKey = findKey(row, /grace\s*in|late\s*in/);
          const graceOutKey = findKey(row, /grace\s*out|early\s*out/);
          const lateInKey = findKey(row, /late\s*in/);
          const earlyOutKey = findKey(row, /early\s*out/);

          const inDate = parseDate(row[inDateKey]);
          const outDate = parseDate(row[outDateKey]);
          const inTime = parseTime(row[inTimeKey]);
          const outTime = parseTime(row[outTimeKey]);

          let durationMinutes = 0;
          if (inDate && inTime && outDate && outTime) {
            const start = new Date(`${inDate}T${inTime}:00`);
            const end = new Date(`${outDate}T${outTime}:00`);
            const diff = Math.max(0, end.getTime() - start.getTime());
            durationMinutes = Math.round(diff / 60000);
          }

          const graceIn = toBool(row[graceInKey] ?? false);
          const graceOut = toBool(row[graceOutKey] ?? false);
          const lateIn = lateInKey ? toBool(row[lateInKey]) : graceIn;
          const earlyOut = earlyOutKey ? toBool(row[earlyOutKey]) : graceOut;

          return {
            cardId: String(row[cardKey] ?? ""),
            empId: String(row[empKey] ?? ""),
            name: String(row[nameKey] ?? ""),
            inDate,
            inTime,
            outDate,
            outTime,
            department: String(row[deptKey] ?? ""),
            college: String(row[collegeKey] ?? ""),
            graceIn,
            graceOut,
            lateIn,
            earlyOut,
            durationMinutes,
          } as PunchRow;
        });

        setPunches(mapped.filter((m) => m.name));
      } catch (e) {
        console.error("Failed to load attendance excel", e);
      }
    })();
  }, []);

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

  const deptPeople = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const p of punches) {
      const dept = p.department || "Unknown";
      let set = map.get(dept);
      if (!set) {
        set = new Set<string>();
        map.set(dept, set);
      }
      if (p.name) set.add(p.name);
    }
    return Array.from(map.entries())
      .map(([department, set]) => {
        const names = Array.from(set).sort((a, b) => a.localeCompare(b));
        const hod = names[0] ?? ""; // rough from first alpha name in dept
        return { department, count: set.size, hod, names };
      })
      .sort((a, b) => a.department.localeCompare(b.department));
  }, [punches]);

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
            <p className="text-xs text-muted-foreground mb-2">Detailed Punches (Excel)</p>
            <div className="overflow-auto rounded-md border">
              <table className="min-w-[1100px] text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="p-2">Card Id</th>
                    <th className="p-2">Employee ID</th>
                    <th className="p-2">Employee Name</th>
                    <th className="p-2">In Date</th>
                    <th className="p-2">In Time</th>
                    <th className="p-2">Out Date</th>
                    <th className="p-2">Out Time</th>
                    <th className="p-2">Department</th>
                    <th className="p-2">College</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {punches.map((r, i) => (
                    <tr key={`${r.empId}-${i}`} className="hover:bg-muted/20">
                      <td className="p-2 text-muted-foreground">{r.cardId}</td>
                      <td className="p-2">{r.empId}</td>
                      <td className="p-2">{r.name}</td>
                      <td className="p-2">{r.inDate}</td>
                      <td className="p-2">{r.inTime}</td>
                      <td className="p-2">{r.outDate}</td>
                      <td className="p-2">{r.outTime}</td>
                      <td className="p-2">{r.department}</td>
                      <td className="p-2">{r.college}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-4">
            <p className="text-xs text-muted-foreground">Cumulative Summary</p>
            {(() => {
              const graceInCount = punches.reduce((s, p) => s + (p.graceIn ? 1 : 0), 0);
              const graceOutCount = punches.reduce((s, p) => s + (p.graceOut ? 1 : 0), 0);
              const lateInCount = punches.reduce((s, p) => s + (p.lateIn ? 1 : 0), 0);
              const earlyOutCount = punches.reduce((s, p) => s + (p.earlyOut ? 1 : 0), 0);
              const doubleGrace = punches.reduce((s, p) => s + (p.graceIn && p.graceOut ? 1 : 0), 0);
              const observations = punches.reduce((s, p) => s + ((p.lateIn || p.earlyOut || p.graceIn || p.graceOut) ? 1 : 0), 0);
              const cls = Math.floor((lateInCount + earlyOutCount) / 4);
              return (
                <div className="overflow-auto rounded-md border">
                  <table className="min-w-[1200px] text-sm">
                    <thead className="bg-muted/40 text-left">
                      <tr>
                        <th className="p-2">Grace In</th>
                        <th className="p-2">Grace Out</th>
                        <th className="p-2">Late In</th>
                        <th className="p-2">Early Out</th>
                        <th className="p-2"># Late In (cumulative)</th>
                        <th className="p-2"># Early Out (cum)</th>
                        <th className="p-2"># Double Grace (cumulative)</th>
                        <th className="p-2"># Observations (cumulative)</th>
                        <th className="p-2"># CLs (cumulative)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="hover:bg-muted/20">
                        <td className="p-2 font-semibold">{graceInCount}</td>
                        <td className="p-2 font-semibold">{graceOutCount}</td>
                        <td className="p-2 font-semibold">{lateInCount}</td>
                        <td className="p-2 font-semibold">{earlyOutCount}</td>
                        <td className="p-2 font-semibold">{lateInCount}</td>
                        <td className="p-2 font-semibold">{earlyOutCount}</td>
                        <td className="p-2 font-semibold">{doubleGrace}</td>
                        <td className="p-2 font-semibold">{observations}</td>
                        <td className="p-2 font-semibold">{cls}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Duration & CL Summary (Faculty from Excel, HOD rough)</p>
            {(() => {
              const thisMonth = new Date().toISOString().slice(0,7); // YYYY-MM
              const monthRows = punches.filter((p) => (p.inDate || p.outDate).startsWith(thisMonth));
              const durations = monthRows.map((p) => p.durationMinutes).filter((m) => m && m > 0);
              const avgMinutes = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
              const normalizedHours = (avgMinutes / 60).toFixed(2);
              const underCount = monthRows.filter((p) => p.durationMinutes > 0 && p.durationMinutes < 450).length; // <7.5h
              const graceBasedCL = Math.floor((monthRows.reduce((s, p) => s + (p.lateIn ? 1 : 0), 0) + monthRows.reduce((s, p) => s + (p.earlyOut ? 1 : 0), 0)) / 4);
              const addnlCLFromAvg = Math.floor(underCount / 4);
              const totalCL = graceBasedCL + addnlCLFromAvg;

              // HOD rough data derived from faculty aggregates
              const hodAvgMinutes = Math.max(450, Math.min(540, avgMinutes + 15));
              const hodNormalized = (hodAvgMinutes / 60).toFixed(2);
              const hodUnder = Math.max(0, Math.round(underCount * 0.2));
              const hodAddnlCL = Math.floor(hodUnder / 4);
              const hodGraceBasedCL = Math.max(0, Math.floor(graceBasedCL * 0.25));
              const hodTotalCL = hodGraceBasedCL + hodAddnlCL;

              return (
                <div className="overflow-auto rounded-md border">
                  <table className="min-w-[980px] text-sm">
                    <thead className="bg-muted/40 text-left">
                      <tr>
                        <th className="p-2">Role</th>
                        <th className="p-2">Duration</th>
                        <th className="p-2">Normalized Duration</th>
                        <th className="p-2">Avg Monthly Duration</th>
                        <th className="p-2">Avg &lt;7.5h</th>
                        <th className="p-2">Addnl CL for Average Duration</th>
                        <th className="p-2">Total CL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      <tr className="hover:bg-muted/20">
                        <td className="p-2 font-medium">Faculty (Excel)</td>
                        <td className="p-2 font-semibold">{avgMinutes} min (avg)</td>
                        <td className="p-2 font-semibold">{normalizedHours} h</td>
                        <td className="p-2 font-semibold">{normalizedHours} h</td>
                        <td className="p-2 font-semibold">{underCount}</td>
                        <td className="p-2 font-semibold">{addnlCLFromAvg}</td>
                        <td className="p-2 font-semibold">{totalCL}</td>
                      </tr>
                      <tr className="hover:bg-muted/20">
                        <td className="p-2 font-medium">HOD (rough)</td>
                        <td className="p-2 font-semibold">{hodAvgMinutes} min (avg)</td>
                        <td className="p-2 font-semibold">{hodNormalized} h</td>
                        <td className="p-2 font-semibold">{hodNormalized} h</td>
                        <td className="p-2 font-semibold">{hodUnder}</td>
                        <td className="p-2 font-semibold">{hodAddnlCL}</td>
                        <td className="p-2 font-semibold">{hodTotalCL}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Department People (HOD view)</p>
            <div className="overflow-auto rounded-md border">
              <table className="min-w-[1000px] text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="p-2">Department</th>
                    <th className="p-2">HOD (rough)</th>
                    <th className="p-2">People Count</th>
                    <th className="p-2">People</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {deptPeople.map((d) => {
                    const preview = d.names.slice(0, 10);
                    const remaining = Math.max(0, d.names.length - preview.length);
                    return (
                      <tr key={d.department} className="hover:bg-muted/20">
                        <td className="p-2 text-muted-foreground">{d.department}</td>
                        <td className="p-2">{d.hod || "—"}</td>
                        <td className="p-2">{d.count}</td>
                        <td className="p-2">{preview.join(", ")}{remaining ? `, +${remaining} more` : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
