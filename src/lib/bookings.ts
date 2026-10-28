import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type BookingRecord = {
  sessionId: string;
  paymentStatus: string;
  amountTotal: number | null;
  currency: string | null;
  customerEmail: string | null;
  briefTitle: string | null;
  eventType: string;
  recordedAt: string;
};

const filePath = path.join(process.cwd(), "data", "bookings.json");

export async function recordBooking(record: BookingRecord): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const existing = await readBookings();
  const next = existing.filter(
    (item) =>
      !(item.sessionId === record.sessionId && item.eventType === record.eventType),
  );
  next.push(record);
  await writeFile(filePath, JSON.stringify(next, null, 2));
}

async function readBookings(): Promise<BookingRecord[]> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as BookingRecord[]) : [];
  } catch {
    return [];
  }
}
