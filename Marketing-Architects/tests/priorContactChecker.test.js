import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkHubSpotHistory } from '../src/services/priorContactChecker.js';
import { setClient } from '../src/services/hubspotClient.js';

function createMockClient() {
  return {
    crm: {
      contacts: {
        searchApi: {
          doSearch: vi.fn(),
        },
      },
    },
  };
}

describe('checkHubSpotHistory', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    setClient(mockClient);
  });

  it('returns no prior contact when contact not found', async () => {
    mockClient.crm.contacts.searchApi.doSearch.mockResolvedValue({ results: [] });

    const result = await checkHubSpotHistory('unknown@test.com');
    expect(result.hasPriorContact).toBe(false);
    expect(result.summary).toBeNull();
  });

  it('returns prior contact when engagement data exists', async () => {
    mockClient.crm.contacts.searchApi.doSearch.mockResolvedValue({
      results: [{
        id: '123',
        properties: {
          hs_email_last_send_date: '2024-11-15',
          notes_last_contacted: '2024-11-10',
          num_contacted_notes: '3',
        },
      }],
    });

    const result = await checkHubSpotHistory('known@test.com');
    expect(result.hasPriorContact).toBe(true);
    expect(result.summary).toContain('3 contact notes');
    expect(result.summary).toContain('last contacted 2024-11-10');
    expect(result.details.contactId).toBe('123');
  });

  it('returns no prior contact when contact exists but has no engagement', async () => {
    mockClient.crm.contacts.searchApi.doSearch.mockResolvedValue({
      results: [{
        id: '456',
        properties: {
          hs_email_last_send_date: null,
          notes_last_contacted: null,
          num_contacted_notes: '0',
        },
      }],
    });

    const result = await checkHubSpotHistory('inactive@test.com');
    expect(result.hasPriorContact).toBe(false);
  });
});
