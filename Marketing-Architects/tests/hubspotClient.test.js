import { describe, it, expect, vi, beforeEach } from 'vitest';
import { upsertContact, upsertCompany, setClient } from '../src/services/hubspotClient.js';

// Mock HubSpot client
function createMockClient() {
  return {
    crm: {
      contacts: {
        basicApi: {
          create: vi.fn(),
          update: vi.fn(),
        },
        searchApi: {
          doSearch: vi.fn(),
        },
      },
      companies: {
        basicApi: {
          create: vi.fn(),
        },
        searchApi: {
          doSearch: vi.fn(),
        },
      },
      associations: {
        v4: {
          basicApi: {
            create: vi.fn(),
          },
        },
      },
    },
  };
}

describe('upsertContact', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    setClient(mockClient);
  });

  it('creates a new contact', async () => {
    mockClient.crm.contacts.basicApi.create.mockResolvedValue({ id: '123' });

    const result = await upsertContact({
      email: 'john@test.com',
      firstName: 'John',
      lastName: 'Smith',
      company: 'Test Ltd',
      enrichment: { lifecycleStage: 'lead', region: 'Auckland' },
    });

    expect(result).toEqual({ id: '123', created: true });
    expect(mockClient.crm.contacts.basicApi.create).toHaveBeenCalledOnce();
  });

  it('updates existing contact on 409 conflict', async () => {
    mockClient.crm.contacts.basicApi.create.mockRejectedValue({ code: 409 });
    mockClient.crm.contacts.searchApi.doSearch.mockResolvedValue({
      results: [{ id: '456' }],
    });
    mockClient.crm.contacts.basicApi.update.mockResolvedValue({});

    const result = await upsertContact({
      email: 'john@test.com',
      firstName: 'John',
      lastName: 'Smith',
      company: 'Test Ltd',
      enrichment: {},
    });

    expect(result).toEqual({ id: '456', created: false });
    expect(mockClient.crm.contacts.basicApi.update).toHaveBeenCalledOnce();
  });
});

describe('upsertCompany', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    setClient(mockClient);
  });

  it('returns existing company if found', async () => {
    mockClient.crm.companies.searchApi.doSearch.mockResolvedValue({
      results: [{ id: '789' }],
    });

    const result = await upsertCompany('Test Ltd');
    expect(result).toEqual({ id: '789', created: false });
    expect(mockClient.crm.companies.basicApi.create).not.toHaveBeenCalled();
  });

  it('creates new company if not found', async () => {
    mockClient.crm.companies.searchApi.doSearch.mockResolvedValue({ results: [] });
    mockClient.crm.companies.basicApi.create.mockResolvedValue({ id: '999' });

    const result = await upsertCompany('New Company');
    expect(result).toEqual({ id: '999', created: true });
  });
});
