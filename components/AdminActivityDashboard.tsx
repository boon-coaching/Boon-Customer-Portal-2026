import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { isAdminEmail } from '../constants';
import { Activity, Users, Building2, BarChart3, RefreshCw, ChevronDown, ChevronUp, X, Calendar } from 'lucide-react';

interface ClientActivity {
  client_name: string | null;
  client_id: string | null;
  unique_users: number;
  total_events: number;
  logins: number;
  dashboard_views: number;
  report_views: number;
  downloads: number;
  last_active: string | null;
}

interface UserActivity {
  email: string | null;
  client_name: string | null;
  client_id: string | null;
  total_events: number;
  logins: number;
  report_views: number;
  downloads: number;
  last_active: string | null;
}

interface EventSummary {
  event_name: string;
  report_type: string | null;
  count: number;
  unique_users: number;
  unique_clients: number;
}

interface PortalEvent {
  id: string;
  user_id: string | null;
  client_id: string | null;
  event_name: string;
  properties: Record<string, any> | null;
  page_path: string | null;
  created_at: string;
}

type SortField = 'last_active' | 'total_events' | 'unique_users' | 'logins' | 'report_views' | 'downloads';
type SortDirection = 'asc' | 'desc';
type DateRange = '7' | '30' | '90' | 'all';

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
];

const AdminActivityDashboard: React.FC = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clientActivity, setClientActivity] = useState<ClientActivity[]>([]);
  const [userActivity, setUserActivity] = useState<UserActivity[]>([]);
  const [eventSummary, setEventSummary] = useState<EventSummary[]>([]);

  // Date range filter
  const [dateRange, setDateRange] = useState<DateRange>('30');

  // Sorting state
  const [clientSort, setClientSort] = useState<{ field: SortField; direction: SortDirection }>({ field: 'total_events', direction: 'desc' });
  const [userSort, setUserSort] = useState<{ field: SortField; direction: SortDirection }>({ field: 'total_events', direction: 'desc' });

  // Client drill-down modal
  const [selectedClient, setSelectedClient] = useState<ClientActivity | null>(null);
  const [clientUsers, setClientUsers] = useState<UserActivity[]>([]);
  const [clientEvents, setClientEvents] = useState<PortalEvent[]>([]);
  const [loadingClientDetails, setLoadingClientDetails] = useState(false);

  const getDateFilter = () => {
    if (dateRange === 'all') return null;
    const days = parseInt(dateRange);
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
  };

  const fetchData = async () => {
    try {
      const dateFilter = getDateFilter();
      const days = dateRange === 'all' ? null : parseInt(dateRange);

      // Try querying the views first (they have proper permissions)
      const [clientRes, userRes, eventRes] = await Promise.all([
        supabase.from('portal_activity_by_client').select('*').limit(100),
        supabase.from('portal_activity_by_user').select('*').limit(200),
        supabase.from('portal_event_summary').select('*').limit(100),
      ]);

      // Check for errors
      if (clientRes.error) {
        console.error('Error fetching client activity:', clientRes.error);
      }
      if (userRes.error) {
        console.error('Error fetching user activity:', userRes.error);
      }
      if (eventRes.error) {
        console.error('Error fetching event summary:', eventRes.error);
      }

      let clients = clientRes.data || [];
      let users = (userRes.data || []).map((u: any) => ({ ...u, client_id: u.client_id || null }));
      let events = eventRes.data || [];

      // If we have a date filter other than 30 days, filter the results client-side
      // (views are 30-day, so we filter down for 7 days, or show as-is for 30/90/all)
      if (days && days < 30) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        clients = clients.filter((c: ClientActivity) =>
          c.last_active && new Date(c.last_active) >= cutoff
        );
        users = users.filter((u: UserActivity) =>
          u.last_active && new Date(u.last_active) >= cutoff
        );
      }

      // For 90 days or all time, try to get more data from portal_events directly
      if (days === null || days > 30) {
        const eventsQuery = supabase
          .from('portal_events')
          .select('*')
          .order('created_at', { ascending: false });

        if (dateFilter) {
          eventsQuery.gte('created_at', dateFilter);
        }

        const { data: rawEvents, error: rawError } = await eventsQuery.limit(10000);

        if (!rawError && rawEvents && rawEvents.length > 0) {
          // Aggregate from raw events
          const clientMap = new Map<string, ClientActivity>();
          const userMap = new Map<string, UserActivity>();
          const eventMap = new Map<string, EventSummary>();

          for (const event of rawEvents) {
            const clientKey = event.client_id || 'unknown';
            const userKey = event.user_id || 'unknown';
            const eventKey = `${event.event_name}|${event.properties?.report_type || ''}`;

            // Client aggregation
            if (!clientMap.has(clientKey)) {
              clientMap.set(clientKey, {
                client_id: event.client_id,
                client_name: event.properties?.client_name || null,
                unique_users: 0,
                total_events: 0,
                logins: 0,
                dashboard_views: 0,
                report_views: 0,
                downloads: 0,
                last_active: event.created_at,
              });
            }
            const client = clientMap.get(clientKey)!;
            client.total_events++;
            if (event.event_name === 'login') client.logins++;
            if (event.event_name === 'dashboard_viewed') client.dashboard_views++;
            if (event.event_name === 'report_viewed') client.report_views++;
            if (event.event_name === 'report_downloaded') client.downloads++;
            if (new Date(event.created_at) > new Date(client.last_active || 0)) {
              client.last_active = event.created_at;
            }

            // User aggregation
            if (!userMap.has(userKey)) {
              userMap.set(userKey, {
                email: event.properties?.email || null,
                client_name: event.properties?.client_name || null,
                client_id: event.client_id,
                total_events: 0,
                logins: 0,
                report_views: 0,
                downloads: 0,
                last_active: event.created_at,
              });
            }
            const user = userMap.get(userKey)!;
            user.total_events++;
            if (event.event_name === 'login') user.logins++;
            if (event.event_name === 'report_viewed') user.report_views++;
            if (event.event_name === 'report_downloaded') user.downloads++;
            if (new Date(event.created_at) > new Date(user.last_active || 0)) {
              user.last_active = event.created_at;
            }

            // Event aggregation
            if (!eventMap.has(eventKey)) {
              eventMap.set(eventKey, {
                event_name: event.event_name,
                report_type: event.properties?.report_type || null,
                count: 0,
                unique_users: 0,
                unique_clients: 0,
              });
            }
            eventMap.get(eventKey)!.count++;
          }

          // Calculate unique users per client
          const usersByClient = new Map<string, Set<string>>();
          for (const event of rawEvents) {
            const clientKey = event.client_id || 'unknown';
            if (!usersByClient.has(clientKey)) {
              usersByClient.set(clientKey, new Set());
            }
            if (event.user_id) {
              usersByClient.get(clientKey)!.add(event.user_id);
            }
          }
          for (const [clientKey, usersSet] of usersByClient) {
            const client = clientMap.get(clientKey);
            if (client) client.unique_users = usersSet.size;
          }

          // Calculate unique users/clients per event type
          const usersPerEvent = new Map<string, Set<string>>();
          const clientsPerEvent = new Map<string, Set<string>>();
          for (const event of rawEvents) {
            const eventKey = `${event.event_name}|${event.properties?.report_type || ''}`;
            if (!usersPerEvent.has(eventKey)) {
              usersPerEvent.set(eventKey, new Set());
              clientsPerEvent.set(eventKey, new Set());
            }
            if (event.user_id) usersPerEvent.get(eventKey)!.add(event.user_id);
            if (event.client_id) clientsPerEvent.get(eventKey)!.add(event.client_id);
          }
          for (const [eventKey, usersSet] of usersPerEvent) {
            const eventData = eventMap.get(eventKey);
            if (eventData) {
              eventData.unique_users = usersSet.size;
              eventData.unique_clients = clientsPerEvent.get(eventKey)?.size || 0;
            }
          }

          clients = Array.from(clientMap.values()).filter(c => c.client_id);
          users = Array.from(userMap.values()).filter(u => u.email || u.total_events > 0);
          events = Array.from(eventMap.values());
        }
      }

      setClientActivity(clients);
      setUserActivity(users);
      setEventSummary(events);
    } catch (err) {
      console.error('Error fetching activity data:', err);
    }
  };

  useEffect(() => {
    const checkAdminAndFetch = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const email = session?.user?.email || '';
        const adminUser = isAdminEmail(email);
        setIsAdmin(adminUser);

        if (adminUser) {
          await fetchData();
        }
      } catch (err) {
        console.error('Error checking admin status:', err);
      } finally {
        setLoading(false);
      }
    };

    checkAdminAndFetch();
  }, []);

  useEffect(() => {
    if (isAdmin && !loading) {
      setRefreshing(true);
      fetchData().finally(() => setRefreshing(false));
    }
  }, [dateRange]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleClientClick = async (client: ClientActivity) => {
    setSelectedClient(client);
    setLoadingClientDetails(true);

    try {
      // Match users by client_id OR client_name (views may not have client_id)
      const filteredUsers = userActivity.filter(u =>
        (client.client_id && u.client_id === client.client_id) ||
        (client.client_name && u.client_name === client.client_name)
      );
      setClientUsers(filteredUsers);

      // Try to fetch recent events for this client
      const dateFilter = getDateFilter();
      let events: PortalEvent[] = [];

      if (client.client_id) {
        let eventsQuery = supabase
          .from('portal_events')
          .select('*')
          .eq('client_id', client.client_id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (dateFilter) {
          eventsQuery = eventsQuery.gte('created_at', dateFilter);
        }

        const { data, error } = await eventsQuery;
        if (!error && data) {
          events = data;
        }
      }

      setClientEvents(events);
    } catch (err) {
      console.error('Error fetching client details:', err);
    } finally {
      setLoadingClientDetails(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Sorted data
  const sortedClientActivity = useMemo(() => {
    return [...clientActivity].sort((a, b) => {
      const aVal = a[clientSort.field] ?? 0;
      const bVal = b[clientSort.field] ?? 0;
      if (clientSort.field === 'last_active') {
        const aDate = new Date(aVal as string || 0).getTime();
        const bDate = new Date(bVal as string || 0).getTime();
        return clientSort.direction === 'desc' ? bDate - aDate : aDate - bDate;
      }
      return clientSort.direction === 'desc'
        ? (bVal as number) - (aVal as number)
        : (aVal as number) - (bVal as number);
    });
  }, [clientActivity, clientSort]);

  const sortedUserActivity = useMemo(() => {
    return [...userActivity].sort((a, b) => {
      const aVal = a[userSort.field] ?? 0;
      const bVal = b[userSort.field] ?? 0;
      if (userSort.field === 'last_active') {
        const aDate = new Date(aVal as string || 0).getTime();
        const bDate = new Date(bVal as string || 0).getTime();
        return userSort.direction === 'desc' ? bDate - aDate : aDate - bDate;
      }
      return userSort.direction === 'desc'
        ? (bVal as number) - (aVal as number)
        : (aVal as number) - (bVal as number);
    });
  }, [userActivity, userSort]);

  const SortableHeader: React.FC<{
    field: SortField;
    label: string;
    currentSort: { field: SortField; direction: SortDirection };
    onSort: (field: SortField) => void;
    align?: 'left' | 'right';
  }> = ({ field, label, currentSort, onSort, align = 'right' }) => (
    <th
      className={`px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => onSort(field)}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        {label}
        {currentSort.field === field && (
          currentSort.direction === 'desc'
            ? <ChevronDown size={14} className="text-boon-blue" />
            : <ChevronUp size={14} className="text-boon-blue" />
        )}
      </div>
    </th>
  );

  const handleClientSort = (field: SortField) => {
    setClientSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const handleUserSort = (field: SortField) => {
    setUserSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="h-64 bg-gray-200 rounded-2xl"></div>
        <div className="h-64 bg-gray-200 rounded-2xl"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <Activity size={32} className="text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-500 max-w-md">
          This page is only accessible to Boon administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Portal Activity</h1>
          <p className="text-gray-600">
            Usage stats for {DATE_RANGE_OPTIONS.find(o => o.value === dateRange)?.label.toLowerCase()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Date Range Dropdown */}
          <div className="relative">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRange)}
              className="appearance-none bg-white border border-gray-200 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-boon-blue focus:border-boon-blue cursor-pointer"
            >
              {DATE_RANGE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          icon={Building2}
          label="Active Clients"
          value={clientActivity.length}
          color="blue"
        />
        <SummaryCard
          icon={Users}
          label="Active Users"
          value={userActivity.length}
          color="green"
        />
        <SummaryCard
          icon={Activity}
          label="Total Events"
          value={clientActivity.reduce((sum, c) => sum + c.total_events, 0)}
          color="purple"
        />
        <SummaryCard
          icon={BarChart3}
          label="Report Views"
          value={clientActivity.reduce((sum, c) => sum + c.report_views, 0)}
          color="orange"
        />
      </div>

      {/* Client Activity Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Building2 size={20} className="text-gray-400" />
            Client Activity
          </h2>
          <p className="text-sm text-gray-500 mt-1">Click a client to see details</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                <SortableHeader field="unique_users" label="Users" currentSort={clientSort} onSort={handleClientSort} />
                <SortableHeader field="total_events" label="Events" currentSort={clientSort} onSort={handleClientSort} />
                <SortableHeader field="logins" label="Logins" currentSort={clientSort} onSort={handleClientSort} />
                <SortableHeader field="report_views" label="Reports" currentSort={clientSort} onSort={handleClientSort} />
                <SortableHeader field="downloads" label="Downloads" currentSort={clientSort} onSort={handleClientSort} />
                <SortableHeader field="last_active" label="Last Active" currentSort={clientSort} onSort={handleClientSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedClientActivity.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No client activity in this period
                  </td>
                </tr>
              ) : (
                sortedClientActivity.map((client, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => handleClientClick(client)}
                  >
                    <td className="px-6 py-4 text-sm font-medium text-boon-blue hover:underline">
                      {client.client_name || client.client_id || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-right">{client.unique_users}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-right font-medium">{client.total_events}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-right">{client.logins}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-right">{client.report_views}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-right">{client.downloads}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 text-right">{formatDate(client.last_active)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Activity Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Users size={20} className="text-gray-400" />
            User Activity
          </h2>
          <p className="text-sm text-gray-500 mt-1">Individual user engagement</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                <SortableHeader field="total_events" label="Events" currentSort={userSort} onSort={handleUserSort} />
                <SortableHeader field="logins" label="Logins" currentSort={userSort} onSort={handleUserSort} />
                <SortableHeader field="report_views" label="Report Views" currentSort={userSort} onSort={handleUserSort} />
                <SortableHeader field="downloads" label="Downloads" currentSort={userSort} onSort={handleUserSort} />
                <SortableHeader field="last_active" label="Last Active" currentSort={userSort} onSort={handleUserSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedUserActivity.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No user activity in this period
                  </td>
                </tr>
              ) : (
                sortedUserActivity.slice(0, 100).map((user, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {user.email || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{user.client_name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-right font-medium">{user.total_events}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-right">{user.logins}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-right">{user.report_views}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-right">{user.downloads}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 text-right">{formatDate(user.last_active)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Event Breakdown Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 size={20} className="text-gray-400" />
            Event Breakdown
          </h2>
          <p className="text-sm text-gray-500 mt-1">Which features and reports are most used</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Event</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Report Type</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Count</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Unique Users</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Unique Clients</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {eventSummary.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No events recorded in this period
                  </td>
                </tr>
              ) : (
                eventSummary
                  .sort((a, b) => b.count - a.count)
                  .map((event, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        event.event_name === 'login' ? 'bg-blue-100 text-blue-700' :
                        event.event_name === 'report_viewed' ? 'bg-green-100 text-green-700' :
                        event.event_name === 'report_downloaded' ? 'bg-purple-100 text-purple-700' :
                        event.event_name === 'dashboard_viewed' ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {event.event_name}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{event.report_type || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-right font-medium">{event.count}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-right">{event.unique_users}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-right">{event.unique_clients}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Client Drill-Down Modal */}
      {selectedClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedClient.client_name || selectedClient.client_id || 'Unknown Client'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedClient.unique_users} users • {selectedClient.total_events} events
                </p>
              </div>
              <button
                onClick={() => setSelectedClient(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingClientDetails ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-32 bg-gray-200 rounded-xl"></div>
                  <div className="h-48 bg-gray-200 rounded-xl"></div>
                </div>
              ) : (
                <>
                  {/* Client Users */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Users size={16} />
                      Users ({clientUsers.length})
                    </h3>
                    <div className="bg-gray-50 rounded-xl overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Email</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Events</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Reports</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Last Active</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {clientUsers.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-4 py-4 text-center text-gray-500 text-sm">
                                No users found
                              </td>
                            </tr>
                          ) : (
                            clientUsers.map((user, idx) => (
                              <tr key={idx}>
                                <td className="px-4 py-2 text-sm text-gray-900">{user.email || 'Unknown'}</td>
                                <td className="px-4 py-2 text-sm text-gray-600 text-right">{user.total_events}</td>
                                <td className="px-4 py-2 text-sm text-gray-600 text-right">{user.report_views}</td>
                                <td className="px-4 py-2 text-sm text-gray-500 text-right">{formatDate(user.last_active)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Activity Timeline */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Activity size={16} />
                      Recent Activity
                    </h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {clientEvents.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">No recent events</p>
                      ) : (
                        clientEvents.map((event, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              event.event_name === 'login' ? 'bg-blue-100 text-blue-700' :
                              event.event_name === 'report_viewed' ? 'bg-green-100 text-green-700' :
                              event.event_name === 'report_downloaded' ? 'bg-purple-100 text-purple-700' :
                              event.event_name === 'dashboard_viewed' ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {event.event_name}
                            </span>
                            {event.properties?.report_type && (
                              <span className="text-sm text-gray-600">{event.properties.report_type}</span>
                            )}
                            <span className="text-xs text-gray-400 ml-auto">{formatDateTime(event.created_at)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryCard: React.FC<{
  icon: React.FC<any>;
  label: string;
  value: number;
  color: 'blue' | 'green' | 'purple' | 'orange';
}> = ({ icon: Icon, label, value, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
};

export default AdminActivityDashboard;
