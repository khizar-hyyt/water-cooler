import type { SessionPayload } from "./auth";
import type { AppState } from "./types";
import {
  addRoommateToState,
  addTurnToState,
  ensureMidnightCaughtUp,
  removeLastTurnFromState,
  removeRoommateFromState,
  recalculateBalancesFromDate,
  resetDayInState,
  runMidnightCalcOnState,
  setAttendanceInState,
  setRoommateBalanceInState,
  setRoommateTurnCountInState,
  today,
  updateRoommateInState,
} from "./store";

export type MutateAction =
  | { type: "addTurn"; roommateId: string; date: string }
  | { type: "setAttendance"; date: string; roommateId: string; status: "present" | "away" }
  | { type: "addRoommate"; name: string; emoji: string; color: string }
  | { type: "updateRoommate"; id: string; patch: Partial<{ name: string; emoji: string; color: string }> }
  | { type: "removeRoommate"; id: string }
  | { type: "runMidnightCalc"; date: string }
  | { type: "resetDay"; date: string }
  | { type: "setTurnCount"; date: string; roommateId: string; count: number }
  | { type: "recalculateFromDate"; fromDate: string }
  | { type: "setBalance"; date: string; roommateId: string; balance: number }
  | { type: "removeLastTurn"; roommateId: string; date: string };

export function authorizeMutation(
  session: SessionPayload | null,
  action: MutateAction
): string | null {
  if (!session) return "Not signed in";

  if (session.role === "admin") return null;

  switch (action.type) {
    case "addTurn":
    case "removeLastTurn":
      return action.roommateId === session.roommateId ? null : "You can only log your own turns";
    case "setAttendance":
      return action.roommateId === session.roommateId ? null : "Only admin can change others' status";
    case "addRoommate":
    case "updateRoommate":
      if (session.role === "admin") return null;
      if (action.id !== session.roommateId) return "You can only edit your own profile";
      return null;
    case "removeRoommate":
      return "Admin only";
    case "runMidnightCalc":
      return null;
    case "resetDay":
    case "setTurnCount":
    case "setBalance":
    case "recalculateFromDate":
      return "Admin only";
    default:
      return "Unknown action";
  }
}

function finishMutation(state: AppState, action: MutateAction): AppState {
  return action.type === "recalculateFromDate" ? state : ensureMidnightCaughtUp(state);
}

export function applyMutation(state: AppState, action: MutateAction): AppState {
  let next: AppState;
  switch (action.type) {
    case "addTurn":
      next = addTurnToState(state, action.roommateId, action.date);
      break;
    case "setAttendance": {
      next = setAttendanceInState(state, action.date, action.roommateId, action.status);
      if (action.date < today()) next = recalculateBalancesFromDate(next, action.date);
      break;
    }
    case "addRoommate":
      next = addRoommateToState(state, action.name, action.emoji, action.color);
      break;
    case "updateRoommate":
      next = updateRoommateInState(state, action.id, action.patch);
      break;
    case "removeRoommate":
      next = removeRoommateFromState(state, action.id);
      break;
    case "runMidnightCalc":
      next = runMidnightCalcOnState(state, action.date);
      break;
    case "resetDay":
      next = resetDayInState(state, action.date);
      break;
    case "setTurnCount": {
      next = setRoommateTurnCountInState(state, action.date, action.roommateId, action.count);
      if (action.date < today()) next = recalculateBalancesFromDate(next, action.date);
      break;
    }
    case "recalculateFromDate":
      next = recalculateBalancesFromDate(state, action.fromDate);
      return ensureMidnightCaughtUp(next);
    case "setBalance": {
      next = setRoommateBalanceInState(state, action.date, action.roommateId, action.balance);
      if (action.date < today()) next = recalculateBalancesFromDate(next, action.date);
      break;
    }
    case "removeLastTurn":
      next = removeLastTurnFromState(state, action.roommateId, action.date);
      break;
    default:
      return state;
  }
  return finishMutation(next, action);
}
