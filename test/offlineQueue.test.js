import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAll, size, clearQueue, newTempId, isTempId,
  enqueueAdd, enqueueUpdate, enqueueDelete,
  amendQueuedAdd, removeQueuedAdd, removeEntry,
} from '../src/lib/offlineQueue.js';

beforeEach(() => clearQueue());

describe('offlineQueue — básico', () => {
  it('começa vazia', () => {
    expect(getAll()).toEqual([]);
    expect(size()).toBe(0);
  });

  it('tempId é reconhecível', () => {
    const id = newTempId();
    expect(isTempId(id)).toBe(true);
    expect(isTempId('uuid-real-123')).toBe(false);
    expect(isTempId(undefined)).toBe(false);
  });

  it('enqueueAdd guarda a transação e o tempId, por ordem', () => {
    enqueueAdd({ description: 'Café', amount: 2 }, 'local-1');
    enqueueAdd({ description: 'Pão', amount: 1 }, 'local-2');
    const q = getAll();
    expect(q).toHaveLength(2);
    expect(q[0].kind).toBe('add');
    expect(q[0].payload.tempId).toBe('local-1');
    expect(q[1].payload.transaction.description).toBe('Pão');
  });
});

describe('offlineQueue — edição/remoção de pendentes (mexe no add)', () => {
  it('amendQueuedAdd altera a transação pendente sem criar nova entrada', () => {
    enqueueAdd({ description: 'Café', amount: 2, category: 'Outros' }, 'local-1');
    amendQueuedAdd('local-1', { amount: 3, category: 'Alimentação' });
    const q = getAll();
    expect(q).toHaveLength(1);
    expect(q[0].payload.transaction).toMatchObject({ description: 'Café', amount: 3, category: 'Alimentação' });
  });

  it('removeQueuedAdd cancela a criação pendente', () => {
    enqueueAdd({ description: 'Café' }, 'local-1');
    enqueueAdd({ description: 'Pão' }, 'local-2');
    removeQueuedAdd('local-1');
    const q = getAll();
    expect(q).toHaveLength(1);
    expect(q[0].payload.tempId).toBe('local-2');
  });
});

describe('offlineQueue — update/delete de ids reais', () => {
  it('enqueueUpdate é last-write-wins por id', () => {
    enqueueUpdate('real-1', { amount: 10 });
    enqueueUpdate('real-1', { amount: 20 });
    const q = getAll();
    expect(q).toHaveLength(1);
    expect(q[0].payload.updates.amount).toBe(20);
  });

  it('enqueueDelete remove updates pendentes do mesmo id', () => {
    enqueueUpdate('real-1', { amount: 10 });
    enqueueDelete('real-1');
    const q = getAll();
    expect(q).toHaveLength(1);
    expect(q[0].kind).toBe('delete');
    expect(q[0].payload.id).toBe('real-1');
  });

  it('updates de ids diferentes coexistem', () => {
    enqueueUpdate('real-1', { amount: 10 });
    enqueueUpdate('real-2', { amount: 99 });
    expect(getAll()).toHaveLength(2);
  });
});

describe('offlineQueue — invariante: nunca update/delete com tempId', () => {
  it('o fluxo recomendado não deixa ids temporários em update/delete', () => {
    // add offline, depois edita e apaga o pendente → tudo via add
    const tmp = newTempId();
    enqueueAdd({ description: 'X', amount: 1 }, tmp);
    amendQueuedAdd(tmp, { amount: 5 });
    // edita um tx real
    enqueueUpdate('real-9', { amount: 7 });
    removeQueuedAdd(tmp); // cancela o pendente
    const q = getAll();
    const temporais = q.filter(e => (e.kind === 'update' || e.kind === 'delete') && isTempId(e.payload.id));
    expect(temporais).toHaveLength(0);
    expect(q).toHaveLength(1);
    expect(q[0].payload.id).toBe('real-9');
  });
});

describe('offlineQueue — removeEntry / clearQueue', () => {
  it('removeEntry tira a entrada pelo id interno', () => {
    enqueueAdd({ description: 'A' }, 'local-1');
    const entryId = getAll()[0].id;
    removeEntry(entryId);
    expect(getAll()).toEqual([]);
  });
  it('clearQueue esvazia tudo', () => {
    enqueueAdd({ description: 'A' }, 'local-1');
    enqueueUpdate('r', {});
    clearQueue();
    expect(size()).toBe(0);
  });
});
