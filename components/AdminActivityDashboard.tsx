import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { isAdminEmail } from '../constants';
import { Activity, Users, Building2, BarChart3, RefreshCw } from 'lucide-react';

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

const AdminActivityDashboard: React.FC = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clientActivity, setClientActivity] = useState<ClientActivity[]>([]);
  const [userActivity, setUserActivity] = useState<UserActivity[]>([]);
  const [eventSummary, setEventSummary] = useState<EventSummary[]>([]);

  const fetchData = async () => {
    try {
      const [clientRes, userRes, eventRes] = await Promise.all([
        supabase.from('portal_activity_by_client').select('*').limit(50),
        supabase.from('portal_activity_by_user').select('*').limit(100),
        supabase.from('portal_event_summary').select('*').limit(50),
      ]);

      if (clientRes.data) setClientActivity(clientRes.data);
      if (userRes.data) setUserActivity(userRes.data);
      if (eventRes.data) setEventSummary(eventRes.data);
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

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Portal Activity</h1>
          <p className="text-gray-600">Usage stats from the last 30 days</p>
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
          <p className="text-sm text-gray-500 mt-1">Portal usage by client company</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Users</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Events</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Logins</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Reports</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Downloads</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clientActivity.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No client activity in the last 30 days
                  </td>
                </tr>
              ) : (
                clientActivity.map((client, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {client.client_name || client.client_id || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-right">{client.unique_users}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 text-right">{client.total_events}</td>
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
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Logins</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Report Views</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Downloads</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {userActivity.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No user activity in the last 30 days
                  </td>
                </tr>
              ) : (
                userActivity.map((user, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {user.email || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{user.client_name || '-'}</td>
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
                    No events recorded in the last 30 days
                  </td>
                </tr>
              ) : (
                eventSummary.map((event, idx) => (
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
