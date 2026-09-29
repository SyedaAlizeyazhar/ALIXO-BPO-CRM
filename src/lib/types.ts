export type Lead = {
  timestamp: string;
  agentName: string;
  firstName: string;
  lastName: string;
  phone?: string;
  campaign: string;
  state: string;
  transferBy?: string;
  duration?: string;
  duplicate?: boolean;
};

export type AgentCount = { agentName: string; count: number };

export type DailyPoint = { day: string; total: number; dupes: number; mine: number };

export type DashboardStats = {
  totalLeads: number;
  todayLeads: number;
  yesterdayLeads: number;
  weekLeads: number;
  monthLeads: number;
  duplicateLeads: number;
  mine: { today: number; yesterday: number; week: number; month: number; total: number };
  daily: DailyPoint[];
  recentLeads: Lead[];
  campaignPerformance: Record<string, number>;
  topAgents: AgentCount[];
};

export type ProgressStats = {
  totalLeads: number;
  todayLeads: number;
  weekLeads: number;
  monthLeads: number;
  rangeLeads: number;
};

export type DupeResult = { duplicate: boolean; matches: Lead[] };

export type Range = "today" | "yesterday" | "week" | "month" | "lastmonth" | "custom";

export type AgentStatus = "Pending" | "Approved" | "Rejected" | "Disabled";

export type Agent = {
  username: string;
  name: string;
  status: AgentStatus;
  callbackUrl: string;
  createdAt: string;
  lastLogin: string;
};

/* Server-only shape: includes the password hash. */
export type AgentRecord = Agent & { passwordHash: string };

export type Me = { username: string; name: string; role: "agent" | "admin"; callbackUrl: string };
