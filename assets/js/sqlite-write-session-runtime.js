// G265: one opt-in same-page write-session FIFO. Legacy writers and tabs are NOT isolated.
import {snapshot,begin,commit,rollback,persist} from './database.js';
import {createSqliteWriteSessionCoordinator} from './sqlite-write-session-coordinator.js';
const sharedWriteSession=createSqliteWriteSessionCoordinator({snapshot,begin,commit,rollback,persist,timeoutMs:30000});
export function runSqliteWriteSession({reason,mutate}={}){return sharedWriteSession.execute({reason,mutate});}
export function getSqliteWriteSessionStatus(){return sharedWriteSession.status();}
