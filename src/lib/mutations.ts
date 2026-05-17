import type { SessionPayload } from "./auth";
import type { AppState } from "./types";
import {
  addRoommateToState,
  addTurnToState,
  removeRoommateFromState,
  resetDayInState,
  runMidnightCalcOnState,
  setAttendanceInState,
  setRoommateTurnCountInState,
  updateRoommateInState,
} from "./store";

export type MutateAction =
  | { type: "addTurn"; roommateId: string }
  | { type: "setAttendance"; date: string; roommateId: string; status: "present" | "away" }
  | { type: "addRoommate"; name: string; emoji: string; color: string }
  | { type: "updateRoommate"; id: string; patch: Partial<{ name: string; emoji: string; color: string }> }
  | { type: "removeRoommate"; id: string }
  | { type: "runMidnightCalc"; date: string }
  | { type: "resetDay"; date: string }
  | { type: "setTurnCount"; date: string; roommateId: string; count: number };

export function authorizeMutation(
  session: SessionPayload | null,
  action: MutateAction
): string | null {
  if (!session) return "Not signed in";

  if (session.role === "admin") return null;

  switch (action.type) {
    case "addTurn":
      return action.roommateId === session.roommateId ? null : "You can only log your own turns";
    case "setAttendance":
      return action.roommateId === session.roommateId ? null : "Only admin can change others' status";
    case "addRoommate":
    case "updateRoommate":
    case "removeRoommate":
      return "Admin only";
    case "runMidnightCalc":
      return null;
    case "resetDay":
    case "setTurnCount":
      return "Admin only";
    default:
      return "Unknown action";
  }
}

export function applyMutation(state: AppState, action: MutateAction): AppState {
  switch (action.type) {
    case "addTurn":
      return addTurnToState(state, action.roommateId);
    case "setAttendance":
      return setAttendanceInState(state, action.date, action.roommateId, action.status);
    case "addRoommate":
      return addRoommateToState(state, action.name, action.emoji, action.color);
    case "updateRoommate":
      return updateRoommateInState(state, action.id, action.patch);
    case "removeRoommate":
      return removeRoommateFromState(state, action.id);
    case "runMidnightCalc":
      return runMidnightCalcOnState(state, action.date);
    case "resetDay":
      return resetDayInState(state, action.date);
    case "setTurnCount":
      return setRoommateTurnCountInState(state, action.date, action.roommateId, action.count);
    default:
      return state;
  }
}
