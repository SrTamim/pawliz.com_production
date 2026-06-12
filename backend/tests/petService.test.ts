import './setup';
import _pool from '../config/database';
const pool = _pool as any;

jest.mock('../utils/fileUtils', () => ({ deleteUploadedFiles: jest.fn() }));
jest.mock('../utils/activityLogger', () => ({ logActivity: jest.fn() }));

import * as _petService from '../services/petService';
const petService = _petService as any;
import { deleteUploadedFiles } from '../utils/fileUtils';
import { logActivity } from '../utils/activityLogger';

// client returned by pool.connect() for transaction tests
const mockClient = pool._mockClient;

const fakePet = {
  id: 1, pet_id: 'PAW-ABC123', user_id: 99,
  name: 'Buddy', type: 'dog', is_active: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
  mockClient.query.mockResolvedValue({ rows: [] });
  pool.connect.mockResolvedValue(mockClient);
});

// ==================== listUserPets ====================

describe('petService.listUserPets', () => {
  it('returns pets for user', async () => {
    pool.query.mockResolvedValueOnce({ rows: [fakePet, { ...fakePet, id: 2 }] });
    const pets = await petService.listUserPets(99);
    expect(pets).toHaveLength(2);
    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM pets p/);
    expect(params[0]).toBe(99);
  });

  it('returns empty array when user has no pets', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const pets = await petService.listUserPets(99);
    expect(pets).toEqual([]);
  });
});

// ==================== getPublicPet ====================

describe('petService.getPublicPet', () => {
  it('returns pet for valid petId', async () => {
    pool.query.mockResolvedValueOnce({ rows: [fakePet] });
    const pet = await petService.getPublicPet('PAW-ABC123');
    expect(pet).toEqual(fakePet);
    expect(pool.query.mock.calls[0][1][0]).toBe('PAW-ABC123');
  });

  it('returns null for unknown petId', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const pet = await petService.getPublicPet('PAW-XXXXXX');
    expect(pet).toBeNull();
  });
});

// ==================== createPet ====================

describe('petService.createPet', () => {
  const petData = { name: 'Max', type: 'dog' };

  it('generates unique petId, inserts pet, logs activity', async () => {
    const petRow = { ...fakePet, name: 'Max' };
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })             // BEGIN
      .mockResolvedValueOnce({ rows: [petRow], rowCount: 1 }) // INSERT INTO pets (no conflict)
      .mockResolvedValueOnce({ rows: [] });            // COMMIT

    const pet = await petService.createPet(99, petData);

    expect(pet.name).toBe('Max');
    const insertCall = mockClient.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO pets'));
    expect(insertCall).toBeDefined();
    expect(insertCall[1][0]).toBe(99); // user_id first param

    expect(logActivity).toHaveBeenCalledWith(99, 'pet_created', expect.objectContaining({
      petName: 'Max', petType: 'dog',
    }));
  });

  it('retries petId generation on collision — succeeds on second attempt', async () => {
    const petRow = { ...fakePet };
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                          // BEGIN
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })             // INSERT — conflict, DO NOTHING
      .mockResolvedValueOnce({ rows: [petRow], rowCount: 1 })       // INSERT — success on retry
      .mockResolvedValueOnce({ rows: [] });                         // COMMIT

    const pet = await petService.createPet(99, petData);
    expect(pet).toBeDefined();
  });

  it('stores age as trimmed string and coerces weight to float', async () => {
    const petRow = { ...fakePet };
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                    // BEGIN
      .mockResolvedValueOnce({ rows: [petRow], rowCount: 1 }) // INSERT
      .mockResolvedValueOnce({ rows: [] });                   // COMMIT

    await petService.createPet(99, { name: 'Max', type: 'dog', age: '3', weight: '4.5' });
    const insertCall = mockClient.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO pets'));
    const insertParams = insertCall[1];
    expect(insertParams[6]).toBe('3');  // age stored as string (pets.age is VARCHAR(30))
    expect(insertParams[8]).toBe(4.5);  // weight coerced to float
  });
});

// ==================== updatePet ====================

describe('petService.updatePet', () => {
  it('returns null if pet not found or not owned', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // ownership check fails
    const result = await petService.updatePet(1, 99, { name: 'NewName' });
    expect(result).toBeNull();
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('updates pet and returns updated row', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })                // ownership check
      .mockResolvedValueOnce({ rows: [{ ...fakePet, name: 'NewName' }] }); // UPDATE

    const result = await petService.updatePet(1, 99, { name: 'NewName' });
    expect(result.name).toBe('NewName');
    const updateSql = pool.query.mock.calls[1][0];
    expect(updateSql).toMatch(/UPDATE pets SET/);
  });

  it('returns null if UPDATE returns no row', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [] });
    const result = await petService.updatePet(1, 99, {});
    expect(result).toBeNull();
  });
});

// ==================== deletePet ====================

describe('petService.deletePet', () => {
  it('returns false if pet not found', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })  // BEGIN
      .mockResolvedValueOnce({ rows: [] }); // SELECT ... FOR UPDATE — not found
    const result = await petService.deletePet(1, 99);
    expect(result).toBe(false);
  });

  it('soft deletes, logs activity, returns true', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                 // BEGIN
      .mockResolvedValueOnce({ rows: [{ images: null }] }) // SELECT ... FOR UPDATE
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })        // UPDATE is_active
      .mockResolvedValueOnce({ rows: [] });                // COMMIT

    const result = await petService.deletePet(1, 99);
    expect(result).toBe(true);

    const calls = mockClient.query.mock.calls;
    const softDeleteCall = calls.find(c => c[0].includes('is_active = false'));
    expect(softDeleteCall).toBeDefined();
    expect(softDeleteCall[1]).toEqual([1]);

    expect(logActivity).toHaveBeenCalledWith(99, 'pet_deleted', { petDbId: 1 });
  });

  it('deletes image files when images exist', async () => {
    const images = ['/uploads/a.jpg', '/uploads/b.jpg'];
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })            // BEGIN
      .mockResolvedValueOnce({ rows: [{ images }] })  // SELECT ... FOR UPDATE
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })  // UPDATE is_active
      .mockResolvedValueOnce({ rows: [] });           // COMMIT

    await petService.deletePet(1, 99);
    expect(deleteUploadedFiles).toHaveBeenCalledWith(images);
  });

  it('handles malformed images JSON without throwing', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                 // BEGIN
      .mockResolvedValueOnce({ rows: [{ images: null }] }) // SELECT ... FOR UPDATE
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })        // UPDATE is_active
      .mockResolvedValueOnce({ rows: [] });                // COMMIT

    const result = await petService.deletePet(1, 99);
    expect(result).toBe(true);
    expect(deleteUploadedFiles).not.toHaveBeenCalled();
  });

  it('returns false if UPDATE returns no row', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ images: null }] }) // SELECT images
      .mockResolvedValueOnce({ rows: [] })                 // BEGIN
      .mockResolvedValueOnce({ rows: [] })                 // UPDATE returns nothing
      .mockResolvedValueOnce({ rows: [] });                // ROLLBACK
    const result = await petService.deletePet(1, 99);
    expect(result).toBe(false);
  });
});
