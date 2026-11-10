export type AdminRole = "super_admin" | "operator" | "viewer";
export type MaritalStatus = "single" | "married";
export type VeteranStatus = "none" | "veteran" | "family";
export type EducationLevel =
  | "diploma"
  | "associate"
  | "bachelor"
  | "master"
  | "phd";
export type MemberStatus = "active" | "suspended" | "resigned";
export type ApplicationStatus =
  | "queued"
  | "approved"
  | "awarded"
  | "rejected"
  | "cancelled";

export interface ScoreBreakdown {
  marital: number;
  children: number;
  veteran: number;
  education: number;
  workHistory: number;
  membership: number;
  performance: number;
  capital: number;
  total: number;
}

export interface Member {
  id: string;
  employeeCode: string;
  nationalId: string | null;
  fullName: string;
  department?: string;
  maritalStatus: MaritalStatus;
  childrenCount: number;
  veteranStatus: VeteranStatus;
  educationLevel: EducationLevel;
  hireDate: string;
  membershipDate: string;
  performanceScore: number;
  // savingsBalance: number;
  employeeSavings: number;
  employerSavings: number;
  previousLoansCount: number;
  previousLoansSum: number;
  status: MemberStatus;
}

export interface QueueItem {
  id: string;
  periodId: string;
  memberId: string;
  member: Member;
  loanType?: string;
  requestedAmount: number;
  approvedAmount?: number;
  score: number;
  rank?: number;
  scoreBreakdown?: ScoreBreakdown;
  status: ApplicationStatus;
  isEmergency: boolean;
  appliedAt: string;
}

export interface LoanPeriod {
  id: string;
  title: string;
  budget: number;
  consumed: number;
  startDate: string;
  endDate: string;
  active: boolean;
}
