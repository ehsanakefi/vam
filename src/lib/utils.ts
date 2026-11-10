import type { ApplicationStatus, MemberStatus } from "@/types/loan";

export const fa = new Intl.NumberFormat("fa-IR");
export const money = (value: number) =>
  `${fa.format(Math.round(value / 1_000_000))} میلیون تومان`;
export const compactMoney = (value: number) =>
  `${fa.format(value / 1_000_000_000)} میلیارد`;

export const statusLabel: Record<ApplicationStatus, string> = {
  queued: "در صف",
  approved: "تأیید شده",
  awarded: "پرداخت شده",
  rejected: "رد شده",
  cancelled: "لغو شده",
};

export const memberStatusLabel: Record<MemberStatus, string> = {
  active: "فعال",
  suspended: "تعلیق",
  resigned: "خاتمه همکاری",
};

export const educationLabel: Record<string, string> = {
  diploma: "دیپلم",
  associate: "کاردانی",
  bachelor: "کارشناسی",
  master: "کارشناسی ارشد",
  phd: "دکتری",
};

export const today = () =>
  new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());
