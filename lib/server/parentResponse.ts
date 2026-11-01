import { NextResponse } from "next/server";
import { PersonRecordError } from "./adminPersonRecord";
export const parentFailure = (e: unknown) =>
  NextResponse.json(
    { error: e instanceof Error ? e.message : "Parent workspace unavailable." },
    { status: e instanceof PersonRecordError ? e.status : 500 },
  );
