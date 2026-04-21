import React, { useEffect, useState, useMemo, useRef } from 'react';
import { isAdminUser } from '../constants';
import { supabase } from '../lib/supabaseClient';
import { useAnalytics, AnalyticsEvents } from '../lib/useAnalytics';
import { Headline } from './brand/Headline';
import { Eyebrow } from './brand/Eyebrow';
import { Badge } from './brand/Badge';
import { Select } from './brand/Select';
import { Button } from './brand/Button';
import { 
  Users, 
  Search, 
  Plus,
  Edit2,
  UserX,
  Upload,
  Download,
  X,
  Check,
  AlertCircle,
  Loader2,
  ArrowUp,
  ArrowDown,
  Trash2
} from 'lucide-react';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  company_email: string;
  company_name: string;
  coaching_program: string;
  salesforce_program_id?: string;
  department: string;
  job_title: string;
  company_role: string;
  start_date: string;
  end_date: string | null;
  status: string;
}

interface DuplicateGroup {
  employees: Employee[];
  reason: string;
}

type ModalMode = 'add' | 'edit' | 'terminate' | 'delete' | null;

// Helper function to check string similarity (simple approach)
const areSimilarNames = (name1: string, name2: string): boolean => {
  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();

  // Exact match
  if (n1 === n2) return true;

  // One is prefix of other (Chris vs Christopher)
  if (n1.startsWith(n2) || n2.startsWith(n1)) return true;

  // Common nickname patterns
  const nicknames: Record<string, string[]> = {
    'christopher': ['chris'],
    'michael': ['mike'],
    'william': ['will', 'bill'],
    'robert': ['rob', 'bob'],
    'elizabeth': ['liz', 'beth'],
    'jennifer': ['jen', 'jenny'],
    'katherine': ['kate', 'kathy', 'katie'],
    'nicholas': ['nick'],
    'richard': ['rick', 'dick'],
    'james': ['jim', 'jimmy'],
    'edward': ['ed', 'eddie'],
    'joseph': ['joe', 'joey'],
    'margaret': ['maggie', 'meg'],
    'patricia': ['pat', 'patty'],
    'alexander': ['alex'],
    'anthony': ['tony'],
    'benjamin': ['ben'],
    'daniel': ['dan', 'danny'],
    'matthew': ['matt'],
    'samuel': ['sam'],
    'thomas': ['tom', 'tommy'],
    'timothy': ['tim'],
    'jonathan': ['jon', 'john'],
  };

  for (const [full, nicks] of Object.entries(nicknames)) {
    if ((n1 === full && nicks.includes(n2)) || (n2 === full && nicks.includes(n1))) {
      return true;
    }
    if (nicks.includes(n1) && nicks.includes(n2)) {
      return true;
    }
  }

  return false;
};

// Helper to extract email prefix
const getEmailPrefix = (email: string): string => {
  return email.split('@')[0].toLowerCase().replace(/[^a-z]/g, '');
};

const EmployeeDashboard: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProgram, setFilterProgram] = useState('All');
  const [sortField, setSortField] = useState<keyof Employee>('last_name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [showBatchUpload, setShowBatchUpload] = useState(false);

  // Duplicate detection state
  const [dismissedDuplicates, setDismissedDuplicates] = useState<Set<string>>(new Set());
  const [showDuplicateReview, setShowDuplicateReview] = useState(false);
  const [selectedDuplicateGroup, setSelectedDuplicateGroup] = useState<DuplicateGroup | null>(null);
  const { track } = useAnalytics();
  const hasTrackedView = useRef(false);

  // Track report view once on mount
  useEffect(() => {
    if (!hasTrackedView.current) {
      hasTrackedView.current = true;
      track(AnalyticsEvents.REPORT_VIEWED, { report_type: 'employees' });
    }
  }, [track]);

  // Fetch employees
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoading(true);
        
        // Get company name from user metadata
        const { data: { session } } = await supabase.auth.getSession();
        const email = session?.user?.email || '';
        const isAdmin = isAdminUser(session);
        
        let company = session?.user?.app_metadata?.company || '';
        let compId = session?.user?.app_metadata?.company_id || '';
        let accName = session?.user?.app_metadata?.account_name || '';
        
        // Check for admin override
        if (isAdmin) {
          try {
            const stored = localStorage.getItem('boon_admin_company_override');
            if (stored) {
              const override = JSON.parse(stored);
              company = override.account_name;
              compId = override.company_id || compId;
              accName = override.account_name || accName;
            }
          } catch {}
        }
        
        setCompanyName(accName || company);
        setCompanyId(compId);

        // Fetch employees - use account_name for grouped companies, otherwise company_id
        let empResult;
        
        if (accName) {
          // Use account_name for multi-company accounts (like Media Arts Lab)
          empResult = await supabase
            .from('employee_manager')
            .select('*')
            .ilike('company_name', `%${accName}%`)
            .neq('company_email', 'asimmons@boon-health.com')
            .order('last_name', { ascending: true });
        } else if (compId) {
          // Use exact company_id match (preferred)
          empResult = await supabase
            .from('employee_manager')
            .select('*')
            .eq('company_id', compId)
            .neq('company_email', 'asimmons@boon-health.com')
            .order('last_name', { ascending: true });
        } else {
          // Fall back to fetching all and filtering by name (legacy)
          empResult = await supabase
            .from('employee_manager')
            .select('*')
            .neq('company_email', 'asimmons@boon-health.com')
            .order('last_name', { ascending: true });
        }

        if (empResult.error) throw empResult.error;
        
        // If we used company_id, no need to filter; otherwise filter by company name
        let filteredData = empResult.data || [];
        
        if (!compId && company) {
          // Legacy fallback: filter by exact company name match to avoid partial matches
          filteredData = filteredData.filter(e => {
            const empCompany = (e.company_name || e.company || '').toLowerCase();
            const targetCompany = company.split(' - ')[0].toLowerCase();
            // Use exact match instead of includes to avoid "Vita" matching "VitalSkin"
            return empCompany === targetCompany || 
                   empCompany.split(' - ')[0] === targetCompany ||
                   empCompany === company.toLowerCase();
          });
        }
        
        // Normalize coaching_program for display
        filteredData = filteredData.map(e => ({
          ...e,
          coaching_program: e.coaching_program || ''
        }));
        
        setEmployees(filteredData);
      } catch (err: any) {
        console.error('Error fetching employees:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  // Get unique programs for filter (prefer program_title)
  const programs = useMemo(() => {
    const uniquePrograms = [...new Set(employees.map(e => e.coaching_program).filter(Boolean))];
    return ['All', ...uniquePrograms.sort()];
  }, [employees]);

  // Filter and sort employees
  const filteredEmployees = useMemo(() => {
    return employees
      .filter(emp => {
        const matchesSearch = 
          `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
          emp.company_email?.toLowerCase().includes(searchTerm.toLowerCase());
        const empProgram = emp.coaching_program;
        const matchesProgram = filterProgram === 'All' || empProgram === filterProgram;
        return matchesSearch && matchesProgram;
      })
      .sort((a, b) => {
        const aVal = a[sortField] || '';
        const bVal = b[sortField] || '';
        if (sortDirection === 'asc') {
          return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        } else {
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        }
      });
  }, [employees, searchTerm, filterProgram, sortField, sortDirection]);

  // Stats - filter by program selection (not search term) so stats reflect the selected program
  const programFilteredEmployees = useMemo(() => {
    if (filterProgram === 'All') return employees;
    return employees.filter(emp => {
      const empProgram = emp.coaching_program;
      return empProgram === filterProgram;
    });
  }, [employees, filterProgram]);

  const getDisplayStatus = (emp: Employee): 'Eligible' | 'Terminated' => {
    if (emp.status === 'Terminated' || emp.status === 'Inactive' || emp.end_date) return 'Terminated';
    return 'Eligible';
  };

  const totalCount = programFilteredEmployees.length;
  const eligibleCount = programFilteredEmployees.filter(e => getDisplayStatus(e) === 'Eligible').length;
  const terminatedCount = programFilteredEmployees.filter(e => getDisplayStatus(e) === 'Terminated').length;

  // Detect potential duplicates
  const potentialDuplicates = useMemo(() => {
    const duplicateGroups: DuplicateGroup[] = [];
    const processed = new Set<string | number>();

    for (let i = 0; i < employees.length; i++) {
      const emp1 = employees[i];
      if (processed.has(emp1.id)) continue;

      const group: Employee[] = [emp1];
      let reason = '';

      for (let j = i + 1; j < employees.length; j++) {
        const emp2 = employees[j];
        if (processed.has(emp2.id)) continue;

        // Check for same last name + similar first name
        if (emp1.last_name?.toLowerCase() === emp2.last_name?.toLowerCase()) {
          if (areSimilarNames(emp1.first_name || '', emp2.first_name || '')) {
            group.push(emp2);
            reason = 'Similar names';
            continue;
          }
        }

        // Check for similar email prefix with same last name
        if (emp1.last_name?.toLowerCase() === emp2.last_name?.toLowerCase()) {
          const prefix1 = getEmailPrefix(emp1.company_email || '');
          const prefix2 = getEmailPrefix(emp2.company_email || '');
          if (prefix1 && prefix2 && (prefix1.includes(prefix2) || prefix2.includes(prefix1))) {
            group.push(emp2);
            reason = 'Similar email addresses';
            continue;
          }
        }
      }

      if (group.length > 1) {
        // Create a unique key for this group
        const groupKey = group.map(e => e.id).sort().join('-');
        if (!dismissedDuplicates.has(groupKey)) {
          group.forEach(e => processed.add(e.id));
          duplicateGroups.push({ employees: group, reason });
        }
      }
    }

    return duplicateGroups;
  }, [employees, dismissedDuplicates]);

  const handleSort = (field: keyof Employee) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleAddEmployee = () => {
    setSelectedEmployee(null);
    setModalMode('add');
  };

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setModalMode('edit');
    track(AnalyticsEvents.EMPLOYEE_VIEWED, { employee_id: String(employee.id) });
  };

  const handleTerminateEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setModalMode('terminate');
  };

  const handleDeleteEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setModalMode('delete');
  };

  const handleModalClose = () => {
    setModalMode(null);
    setSelectedEmployee(null);
  };

  const handleSaveSuccess = (employee: Employee, action: 'create' | 'update' | 'delete') => {
    if (action === 'create') {
      setEmployees([...employees, employee]);
    } else if (action === 'update') {
      setEmployees(employees.map(e => e.id === employee.id ? employee : e));
    } else if (action === 'delete') {
      setEmployees(employees.filter(e => e.id !== employee.id));
    }
    handleModalClose();
  };

  const handleBatchUploadSuccess = (newEmployees: Employee[]) => {
    setEmployees([...employees, ...newEmployees]);
    setShowBatchUpload(false);
  };

  const handleDismissDuplicate = (group: DuplicateGroup) => {
    const groupKey = group.employees.map(e => e.id).sort().join('-');
    setDismissedDuplicates(prev => new Set([...prev, groupKey]));
  };

  const handleReviewDuplicate = (group: DuplicateGroup) => {
    setSelectedDuplicateGroup(group);
    setShowDuplicateReview(true);
  };

  const handleMergeEmployees = async (keepEmployee: Employee, deleteEmployee: Employee) => {
    try {
      console.log('Merging employees:', { keep: keepEmployee.id, delete: deleteEmployee.id });

      // Use RPC function to merge employees (bypasses RLS)
      // Pass IDs as numbers — employee_manager.id is BIGINT
      const { data, error: rpcError } = await supabase.rpc('merge_duplicate_employees', {
        keep_employee_id: Number(keepEmployee.id),
        delete_employee_id: Number(deleteEmployee.id)
      });

      if (rpcError) {
        console.error('RPC error:', rpcError);
        throw rpcError;
      }

      if (data && !data.success) {
        console.error('Merge failed:', data.error);
        throw new Error(data.error || 'Failed to merge employees');
      }

      console.log('Merge result:', data);

      // Update local state
      setEmployees(employees.filter(e => e.id !== deleteEmployee.id));
      setShowDuplicateReview(false);
      setSelectedDuplicateGroup(null);
    } catch (err: any) {
      console.error('Error merging employees:', err);
      alert(err.message || 'Failed to merge employees. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6 animate-pulse max-w-7xl mx-auto">
        <div className="h-12 bg-gray-200 rounded w-1/4 mb-8"></div>
        <div className="h-64 bg-gray-200 rounded-xl"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Error Loading Employees</h2>
        <p className="text-gray-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 md:pb-12 font-sans">
      {/* Modal */}
      {modalMode && (
        <EmployeeModal
          mode={modalMode}
          employee={selectedEmployee}
          companyName={companyName}
          companyId={companyId}
          programs={programs.filter(p => p !== 'All')}
          existingEmployees={employees}
          onClose={handleModalClose}
          onSave={handleSaveSuccess}
        />
      )}

      {/* Batch Upload Modal */}
      {showBatchUpload && (
        <BatchUploadModal
          companyName={companyName}
          companyId={companyId}
          onClose={() => setShowBatchUpload(false)}
          onSuccess={handleBatchUploadSuccess}
        />
      )}

      {/* Duplicate Review Modal */}
      {showDuplicateReview && selectedDuplicateGroup && (
        <DuplicateMergeModal
          group={selectedDuplicateGroup}
          onClose={() => {
            setShowDuplicateReview(false);
            setSelectedDuplicateGroup(null);
          }}
          onMerge={handleMergeEmployees}
          onDismiss={() => {
            handleDismissDuplicate(selectedDuplicateGroup);
            setShowDuplicateReview(false);
            setSelectedDuplicateGroup(null);
          }}
        />
      )}

      {/* Duplicate Warning Banner */}
      {potentialDuplicates.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-bold text-amber-800">
                {potentialDuplicates.length} potential duplicate{potentialDuplicates.length > 1 ? 's' : ''} found
              </h3>
              <p className="text-sm text-amber-700 mt-1">
                We detected employees that may be duplicates. Review and merge to keep your roster clean.
              </p>
              <div className="mt-3 space-y-2">
                {potentialDuplicates.slice(0, 3).map((group, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-amber-100">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-gray-900">
                        {group.employees.map(e => `${e.first_name} ${e.last_name}`).join(' & ')}
                      </span>
                      <span className="text-amber-600 text-xs">({group.reason})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReviewDuplicate(group)}
                        className="text-xs font-medium text-boon-blue hover:text-boon-darkBlue"
                      >
                        Review
                      </button>
                      <button
                        onClick={() => handleDismissDuplicate(group)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
                {potentialDuplicates.length > 3 && (
                  <p className="text-xs text-amber-600 mt-2">
                    And {potentialDuplicates.length - 3} more...
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Brand v2 page header (Boon Design System: Eyebrow + Headline) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="pt-2">
          <Eyebrow>Employee manager</Eyebrow>
          <Headline statement="Your roster," kicker="clean and current." />
          <p className="font-body text-[15px] leading-[1.55] text-gray-500 mt-3 max-w-[62ch]">
            <b className="font-semibold text-boon-navy">{totalCount} {totalCount === 1 ? 'employee' : 'employees'}</b> in the coaching program. Add, edit, and terminate access without leaving this screen.
          </p>
        </div>

        {/* Desktop Add Button */}
        <Button
          onClick={handleAddEmployee}
          icon={<Plus size={18} />}
          className="hidden md:inline-flex"
        >
          Add Employee
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-boon-blue/10 rounded-xl">
              <Users className="w-6 h-6 text-boon-blue" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Total</p>
              <p className="text-3xl font-extrabold tabular-nums text-boon-dark">{totalCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-boon-green/10 rounded-xl">
              <Check className="w-6 h-6 text-boon-green" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Eligible</p>
              <p className="text-3xl font-extrabold tabular-nums text-boon-green">{eligibleCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-50 rounded-xl">
              <UserX className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Terminated</p>
              <p className="text-3xl font-extrabold tabular-nums text-red-400">{terminatedCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96 bg-gray-50 rounded-lg group focus-within:ring-2 ring-boon-blue/30 transition">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Find by name or email..." 
            className="w-full pl-10 pr-4 py-2.5 bg-transparent border-none focus:outline-none text-sm font-medium text-gray-700 placeholder:text-gray-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="w-full sm:w-auto sm:min-w-[180px]">
            <Select
              value={filterProgram}
              onChange={(e) => setFilterProgram(e.target.value)}
              className="bg-white border-gray-200"
            >
              {programs.map(prog => (
                <option key={prog} value={prog}>{prog === 'All' ? 'All Programs' : prog}</option>
              ))}
            </Select>
          </div>

          <button 
            onClick={() => setShowBatchUpload(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
          >
            <Upload size={16} />
            Batch Upload
          </button>
        </div>
      </div>

      {/* Mobile Add Button - Fixed Bottom */}
      <div className="md:hidden fixed bottom-6 left-6 right-6 z-40">
        <Button
          onClick={handleAddEmployee}
          size="lg"
          icon={<Plus size={20} />}
          className="w-full"
        >
          Add Employee
        </Button>
      </div>

      {/* Employee List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        
        {/* Mobile View: Cards */}
        <div className="block md:hidden divide-y divide-gray-100">
           {filteredEmployees.length > 0 ? (
             filteredEmployees.map((emp) => {
               const displayStatus = getDisplayStatus(emp);
               const isTerminated = displayStatus === 'Terminated';
               return (
                 <div key={emp.id} className={`p-4 ${isTerminated ? 'opacity-60' : ''}`}>
                    <div className="flex justify-between items-start mb-2">
                       <div>
                          <h3 className="font-bold text-gray-800">{emp.first_name} {emp.last_name}</h3>
                          <p className="text-sm text-gray-500">{emp.job_title || 'No Title'}</p>
                       </div>
                       {displayStatus === 'Terminated' ? (
                          <Badge variant="error">Terminated</Badge>
                        ) : (
                          <Badge variant="success">Eligible</Badge>
                        )}
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-3 space-y-1">
                       <p className="truncate">{emp.company_email}</p>
                       <div className="flex items-center gap-2">
                          {(emp.coaching_program) && (
                             <span className="px-2 py-0.5 rounded text-xs font-bold bg-boon-blue/10 text-boon-blue">
                               {emp.coaching_program}
                             </span>
                          )}
                          <span className="text-gray-400">•</span>
                          <span>{emp.department || 'No Dept'}</span>
                       </div>
                    </div>

                    <div className="flex gap-2">
                       <button
                          onClick={() => handleEditEmployee(emp)}
                          className="flex-1 py-2 text-sm font-bold text-gray-600 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100"
                        >
                          Edit
                        </button>
                        {displayStatus === 'Eligible' && (
                          <button
                            onClick={() => handleTerminateEmployee(emp)}
                            className="px-4 py-2 text-gray-400 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-boon-dark"
                            title="Deactivate"
                          >
                            <UserX size={16} />
                          </button>
                        )}
                        <button
                            onClick={() => handleDeleteEmployee(emp)}
                            className="px-4 py-2 text-gray-400 bg-gray-50 rounded-lg border border-gray-200 hover:bg-red-50 hover:text-red-500"
                            title="Delete Permanently"
                          >
                            <Trash2 size={16} />
                        </button>
                    </div>
                 </div>
               );
             })
           ) : (
             <div className="p-8 text-center text-gray-400 italic">
                No employees found.
             </div>
           )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <SortableHeader 
                  label="First Name" 
                  field="first_name" 
                  currentSort={sortField} 
                  direction={sortDirection} 
                  onSort={handleSort} 
                />
                <SortableHeader 
                  label="Last Name" 
                  field="last_name" 
                  currentSort={sortField} 
                  direction={sortDirection} 
                  onSort={handleSort} 
                />
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Program</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Job Title</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((emp) => {
                  const displayStatus = getDisplayStatus(emp);
                  const isTerminated = displayStatus === 'Terminated';
                  return (
                    <tr
                      key={emp.id}
                      className={`hover:bg-gray-50 transition-colors ${isTerminated ? 'opacity-50' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <span className="font-semibold text-gray-800 text-sm">{emp.first_name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-gray-800 text-sm">{emp.last_name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-600 text-sm">{emp.company_email || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        {(emp.coaching_program) ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-boon-blue/10 text-boon-blue">
                            {emp.coaching_program}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-600 text-sm">{emp.department || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-600 text-sm">{emp.job_title || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        {displayStatus === 'Terminated' ? (
                          <Badge variant="error">Terminated</Badge>
                        ) : (
                          <Badge variant="success">Eligible</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditEmployee(emp)}
                            className="p-2 text-gray-400 hover:text-boon-blue hover:bg-boon-blue/10 rounded-lg transition"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          {displayStatus === 'Eligible' && (
                            <button
                              onClick={() => handleTerminateEmployee(emp)}
                              className="p-2 text-gray-400 hover:text-boon-dark hover:bg-gray-200 rounded-lg transition"
                              title="Terminate"
                            >
                              <UserX size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteEmployee(emp)}
                            className="p-2 text-gray-400 hover:text-boon-red hover:bg-boon-red/10 rounded-lg transition"
                            title="Delete Permanently"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400 italic">
                    No employees found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Sortable Header Component
const SortableHeader = ({ 
  label, 
  field, 
  currentSort, 
  direction, 
  onSort 
}: { 
  label: string; 
  field: keyof Employee; 
  currentSort: keyof Employee; 
  direction: 'asc' | 'desc'; 
  onSort: (field: keyof Employee) => void;
}) => (
  <th 
    className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition"
    onClick={() => onSort(field)}
  >
    <div className="flex items-center gap-1">
      {label}
      {currentSort === field && (
        direction === 'asc' ? <ArrowUp size={14} className="text-boon-blue" /> : <ArrowDown size={14} className="text-boon-blue" />
      )}
    </div>
  </th>
);

// Employee Modal Component
const EmployeeModal = ({
  mode,
  employee,
  companyName,
  companyId,
  programs,
  existingEmployees = [],
  onClose,
  onSave
}: {
  mode: ModalMode;
  employee: Employee | null;
  companyName: string;
  companyId: string;
  programs: string[];
  existingEmployees?: Employee[];
  onClose: () => void;
  onSave: (employee: Employee, action: 'create' | 'update' | 'delete') => void;
}) => {
  const [formData, setFormData] = useState({
    first_name: employee?.first_name || '',
    last_name: employee?.last_name || '',
    company_email: employee?.company_email || '',
    program: employee?.coaching_program || '',
    department: employee?.department || '',
    job_title: employee?.job_title || '',
    company_role: employee?.company_role || '',
    start_date: employee?.start_date || new Date().toISOString().split('T')[0],
    end_date: employee?.end_date || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newProgramName, setNewProgramName] = useState('');

  const isDelete = mode === 'delete';
  const isTerminate = mode === 'terminate';
  const isEdit = mode === 'edit';
  const isAdd = mode === 'add';

  // Check for potential duplicate when adding
  const potentialDuplicate = useMemo(() => {
    if (!isAdd) return null;
    if (!formData.first_name && !formData.last_name && !formData.company_email) return null;

    return existingEmployees.find(emp => {
      // Check email match
      if (formData.company_email && emp.company_email?.toLowerCase() === formData.company_email.toLowerCase()) {
        return true;
      }
      // Check name match
      if (formData.last_name && emp.last_name?.toLowerCase() === formData.last_name.toLowerCase()) {
        if (areSimilarNames(formData.first_name || '', emp.first_name || '')) {
          return true;
        }
      }
      return false;
    });
  }, [isAdd, formData.first_name, formData.last_name, formData.company_email, existingEmployees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // Clean up form data
    const cleanedData = {
      ...formData,
      program: formData.program === '__new__' ? newProgramName : formData.program,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
    };

    try {
      if (isDelete) {
        // Hard Delete - Use select() to ensure row was actually removed
        // Belt-and-suspenders: filter by company_id in addition to RLS
        const { data, error } = await supabase
            .from('employee_manager')
            .delete()
            .eq('id', employee!.id)
            .eq('company_id', companyId)
            .select();

        if (error) throw error;
        
        // Check if deletion actually occurred
        if (!data || data.length === 0) {
           throw new Error('Record not found or already deleted. Please refresh.');
        }

        // Pass the deleted employee back so UI can filter it out
        onSave(employee!, 'delete');

      } else if (isAdd) {
        // Create SF Contact + employee_manager row via edge function
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-employee-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            action: 'add',
            email: cleanedData.company_email,
            first_name: cleanedData.first_name,
            last_name: cleanedData.last_name,
            company_id: companyId,
            job_title: cleanedData.job_title || undefined,
            company_name: companyName,
            account_name: companyName,
            program: cleanedData.program || undefined,
          })
        });
        const fnData = await res.json();
        if (!res.ok || fnData.error) throw new Error(fnData.error || `Request failed: ${res.status}`);

        // Refetch the full row for the UI
        const { data, error } = await supabase
          .from('employee_manager')
          .select()
          .eq('id', fnData.employee_id)
          .single();
        if (error) throw error;
        onSave(data, 'create');
      } else if (isEdit) {
        // Update via edge function so changes sync to Salesforce
        const { data: { session: editSession } } = await supabase.auth.getSession();
        const editRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-employee-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${editSession?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            action: 'update',
            employee_id: Number(employee!.id),
            company_id: companyId,
            fields: cleanedData,
          })
        });
        const editData = await editRes.json();
        if (!editRes.ok || editData.error) throw new Error(editData.error || `Request failed: ${editRes.status}`);

        // Refetch the full row for the UI
        const { data, error } = await supabase
          .from('employee_manager')
          .select()
          .eq('id', employee!.id)
          .single();
        if (error) throw error;
        onSave(data, 'update');
      } else if (isTerminate) {
        // Terminate in SF + employee_manager via edge function
        const { data: { session: termSession } } = await supabase.auth.getSession();
        const termRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-employee-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${termSession?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            action: 'deactivate',
            email: employee!.company_email,
            company_id: companyId,
          })
        });
        const termData = await termRes.json();
        if (!termRes.ok || termData.error) throw new Error(termData.error || `Request failed: ${termRes.status}`);

        // Refetch updated row for UI
        const { data, error } = await supabase
          .from('employee_manager')
          .select()
          .eq('id', employee!.id)
          .single();
        if (error) throw error;
        onSave(data, 'update');
      }
    } catch (err: any) {
      console.error('Error saving employee:', err);
      // Supabase FK constraint errors usually contain the table name
      if (err.message?.includes('foreign key constraint') || err.code === '23503') {
         setError('Cannot delete this employee because they have associated sessions or data. Please contact support.');
      } else {
         setError(err.message || 'Failed to save employee');
      }
    } finally {
      setSaving(false);
    }
  };

  const modalTitle = isDelete 
    ? 'Delete Employee' 
    : isAdd 
      ? 'Add Employee' 
      : isEdit 
        ? 'Edit Employee' 
        : 'Terminate Employee';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-boon-dark/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
          <div>
            <h2 className={`text-2xl font-black uppercase tracking-tight ${isDelete ? 'text-boon-red' : 'text-boon-dark'}`}>
              {modalTitle}
            </h2>
            {isTerminate && (
              <p className="text-sm text-gray-500 mt-1">
                Set an end date to deactivate this employee's coaching access.
              </p>
            )}
             {isDelete && (
              <p className="text-sm text-gray-500 mt-1">
                Permanently remove this record from the database.
              </p>
            )}
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          {/* Duplicate Warning */}
          {isAdd && potentialDuplicate && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-bold">Possible duplicate detected</p>
                  <p className="mt-1">
                    An employee named <strong>{potentialDuplicate.first_name} {potentialDuplicate.last_name}</strong>
                    {potentialDuplicate.company_email && <> ({potentialDuplicate.company_email})</>} already exists.
                  </p>
                  <p className="mt-1 text-amber-600">
                    Did you mean to edit the existing employee instead?
                  </p>
                </div>
              </div>
            </div>
          )}

          {isDelete ? (
             <div className="space-y-4">
                 <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                     <p className="font-bold text-gray-800 text-lg mb-1">
                        Are you sure you want to delete {employee?.first_name} {employee?.last_name}?
                     </p>
                     <p className="text-gray-600">
                        This action <strong>cannot be undone</strong>. This will permanently remove the employee record. 
                        If they have associated sessions, you may not be able to delete them without removing sessions first.
                     </p>
                 </div>
                 <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-500 font-bold uppercase tracking-wide mb-1">Employee Details</p>
                    <p className="text-gray-800">{employee?.first_name} {employee?.last_name}</p>
                    <p className="text-gray-600 text-sm">{employee?.company_email}</p>
                 </div>
             </div>
          ) : isTerminate ? (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="font-bold text-gray-800">{employee?.first_name} {employee?.last_name}</p>
                <p className="text-sm text-gray-500">{employee?.company_email}</p>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  End Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ring-boon-blue/30"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ring-boon-blue/30"
                  placeholder="John"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ring-boon-blue/30"
                  placeholder="Smith"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Company Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.company_email}
                  onChange={(e) => setFormData({ ...formData, company_email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ring-boon-blue/30"
                  placeholder="john.smith@company.com"
                />
              </div>

              <div>
                <Select
                  label="Program"
                  value={formData.program}
                  onChange={(e) => setFormData({ ...formData, program: e.target.value })}
                >
                  <option value="">Select a program</option>
                  <option value="GROW">GROW</option>
                  <option value="EXEC">EXEC</option>
                  <option value="Scale">Scale</option>
                  {programs.filter(p => !['GROW', 'EXEC', 'Scale'].includes(p)).map(prog => (
                    <option key={prog} value={prog}>{prog}</option>
                  ))}
                  <option value="__new__">+ Add new program</option>
                </Select>
                {formData.program === '__new__' && (
                  <input
                    type="text"
                    value={newProgramName}
                    onChange={(e) => setNewProgramName(e.target.value)}
                    placeholder="Enter new program name"
                    className="w-full mt-2 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ring-boon-blue/30"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Department
                </label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ring-boon-blue/30"
                  placeholder="Engineering"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Job Title
                </label>
                <input
                  type="text"
                  value={formData.job_title}
                  onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ring-boon-blue/30"
                  placeholder="Senior Manager"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Role
                </label>
                <input
                  type="text"
                  value={formData.company_role}
                  onChange={(e) => setFormData({ ...formData, company_role: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ring-boon-blue/30"
                  placeholder="People Manager"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ring-boon-blue/30"
                />
              </div>

              {isEdit && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ring-boon-blue/30"
                  />
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 shrink-0">
            <Button type="button" onClick={onClose} variant="ghost">
              Cancel
            </Button>
            <button
              type="submit"
              disabled={saving}
              className={`px-6 py-3 font-bold rounded-xl transition flex items-center gap-2 ${
                isDelete 
                  ? 'bg-boon-red text-white hover:bg-red-600'
                  : isTerminate 
                    ? 'bg-gray-800 text-white hover:bg-gray-900' 
                    : 'bg-boon-blue text-white hover:bg-boon-darkBlue'
              } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isDelete 
                ? 'Delete Permanently' 
                : isTerminate 
                  ? 'Deactivate Employee' 
                  : isEdit 
                    ? 'Save Changes' 
                    : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Batch Upload Modal Component
const BatchUploadModal = ({
  companyName,
  companyId,
  onClose,
  onSuccess
}: {
  companyName: string;
  companyId: string;
  onClose: () => void;
  onSuccess: (employees: Employee[]) => void;
}) => {
  const [csvData, setCsvData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'done'>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadResults, setUploadResults] = useState<{ succeeded: any[]; failed: string[] }>({ succeeded: [], failed: [] });

  const requiredFields = ['first_name', 'last_name', 'company_email'];
  const optionalFields = ['program', 'department', 'job_title', 'company_role', 'start_date'];

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        setError('CSV must have a header row and at least one data row');
        return;
      }

      const headerRow: string[] = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      setHeaders(headerRow);

      const dataRows = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const row: Record<string, string> = {};
        headerRow.forEach((header: string, i) => {
          row[header] = values[i] || '';
        });
        return row;
      });

      setCsvData(dataRows);
      
      // Auto-map obvious fields
      const autoMapping: Record<string, string> = {};
      headerRow.forEach((header: string) => {
        const lowerHeader = header.toLowerCase().replace(/[_\s]/g, '');
        if (lowerHeader.includes('firstname') || lowerHeader === 'first') {
          autoMapping['first_name'] = header;
        } else if (lowerHeader.includes('lastname') || lowerHeader === 'last') {
          autoMapping['last_name'] = header;
        } else if (lowerHeader.includes('email')) {
          autoMapping['company_email'] = header;
        } else if (lowerHeader.includes('program')) {
          autoMapping['program'] = header;
        } else if (lowerHeader.includes('department') || lowerHeader === 'dept') {
          autoMapping['department'] = header;
        } else if (lowerHeader.includes('title') || lowerHeader.includes('jobtitle')) {
          autoMapping['job_title'] = header;
        } else if (lowerHeader.includes('role')) {
          autoMapping['company_role'] = header;
        } else if (lowerHeader.includes('start') || lowerHeader.includes('hiredate')) {
          autoMapping['start_date'] = header;
        }
      });
      setMapping(autoMapping);
      setStep('map');
      setError(null);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      handleFileUpload(file);
    } else {
      setError('Please upload a CSV file');
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const getMappedData = () => {
    return csvData.map((row: any) => {
      const mapped: Record<string, any> = {
        company_name: companyName,
        account_name: companyName,
        company_id: companyId || null,
        status: 'Active'
      };
      Object.entries(mapping).forEach(([field, csvHeader]) => {
        const headerKey = csvHeader as string;
        if (headerKey && row[headerKey]) {
          mapped[field] = row[headerKey];
        }
      });
      return mapped;
    }).filter((row: any) => row.first_name && row.last_name && row.company_email);
  };

  const handleUpload = async () => {
    const mappedData = getMappedData();
    if (mappedData.length === 0) {
      setError('No valid rows to upload. Ensure first_name, last_name, and company_email are mapped.');
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress({ current: 0, total: mappedData.length });

    const succeeded: any[] = [];
    const failed: string[] = [];
    const { data: { session: batchSession } } = await supabase.auth.getSession();

    for (let i = 0; i < mappedData.length; i++) {
      const row = mappedData[i];
      setUploadProgress({ current: i + 1, total: mappedData.length });
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-employee-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${batchSession?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            action: 'add',
            email: row.company_email,
            first_name: row.first_name,
            last_name: row.last_name,
            company_id: companyId,
            job_title: row.job_title || undefined,
            company_name: companyName,
            account_name: companyName,
            program: row.program || undefined,
          })
        });
        const fnData = await res.json();
        if (!res.ok || fnData.error) throw new Error(fnData.error || `Request failed: ${res.status}`);

        const { data, error } = await supabase
          .from('employee_manager')
          .select()
          .eq('id', fnData.employee_id)
          .single();
        if (error) throw error;
        succeeded.push(data);
      } catch (rowErr: any) {
        failed.push(`${row.first_name} ${row.last_name} (${row.company_email}): ${rowErr.message}`);
      }
    }

    setUploadResults({ succeeded, failed });
    setUploading(false);
    setStep('done');
  };

  const validRows = getMappedData();
  const missingRequired = requiredFields.filter(f => !mapping[f]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-boon-dark/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-2xl font-black text-boon-dark uppercase tracking-tight">
              Batch Upload Employees
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Upload a CSV file to add multiple employees at once
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          {step === 'upload' && (
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition ${
                dragActive ? 'border-boon-blue bg-boon-blue/5' : 'border-gray-200'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-medium mb-2">Drag and drop your CSV file here</p>
              <p className="text-gray-400 text-sm mb-4">or</p>
              <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-boon-blue text-white font-bold rounded-xl hover:bg-boon-darkBlue transition cursor-pointer">
                <Upload size={18} />
                Choose File
                <input type="file" accept=".csv" className="hidden" onChange={handleFileInput} />
              </label>
              <p className="text-gray-400 text-xs mt-4">
                Required columns: first_name, last_name, company_email
              </p>
              <button 
                onClick={() => {
                  const csvContent = 'first_name,last_name,company_email,department,job_title,company_role\nJohn,Doe,john.doe@company.com,Engineering,Software Engineer,Individual Contributor\nJane,Smith,jane.smith@company.com,Marketing,Marketing Manager,Manager';
                  const blob = new Blob([csvContent], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'employee_upload_template.csv';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="inline-flex items-center gap-1 text-xs text-boon-blue hover:underline mt-2"
              >
                <Download size={14} />
                Download template
              </button>
            </div>
          )}

          {step === 'map' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-bold text-gray-800 mb-3">Required Fields</h3>
                  {requiredFields.map(field => (
                    <div key={field} className="mb-3">
                      <Select
                        label={`${field.replace(/_/g, ' ')} *`}
                        value={mapping[field] || ''}
                        onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
                        error={!mapping[field] ? 'Required' : undefined}
                      >
                        <option value="">-- Select column --</option>
                        {headers.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </Select>
                    </div>
                  ))}
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 mb-3">Optional Fields</h3>
                  {optionalFields.map(field => (
                    <div key={field} className="mb-3">
                      <Select
                        label={field.replace(/_/g, ' ')}
                        value={mapping[field] || ''}
                        onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
                      >
                        <option value="">-- Skip --</option>
                        {headers.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <button
                  onClick={() => { setStep('upload'); setCsvData([]); setHeaders([]); }}
                  className="text-gray-500 font-medium hover:text-gray-700"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep('preview')}
                  disabled={missingRequired.length > 0}
                  className={`px-5 py-2.5 font-bold rounded-xl transition ${
                    missingRequired.length > 0
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-boon-blue text-white hover:bg-boon-darkBlue'
                  }`}
                >
                  Preview ({validRows.length} rows)
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  <span className="font-bold text-boon-green">{validRows.length}</span> employees ready to upload
                </p>
              </div>

              <div className="border rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-bold text-gray-500">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-bold text-gray-500">Email</th>
                      <th className="px-4 py-2 text-left text-xs font-bold text-gray-500">Program</th>
                      <th className="px-4 py-2 text-left text-xs font-bold text-gray-500">Department</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {validRows.slice(0, 50).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{row.first_name} {row.last_name}</td>
                        <td className="px-4 py-2 text-gray-600">{row.company_email}</td>
                        <td className="px-4 py-2 text-gray-600">{row.program || '-'}</td>
                        <td className="px-4 py-2 text-gray-600">{row.department || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {validRows.length > 50 && (
                <p className="text-xs text-gray-400 text-center">Showing first 50 of {validRows.length} rows</p>
              )}

              <div className="flex justify-between items-center pt-4 border-t">
                <button
                  onClick={() => setStep('map')}
                  className="text-gray-500 font-medium hover:text-gray-700"
                >
                  ← Back to Mapping
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="px-6 py-3 bg-boon-green text-white font-bold rounded-xl hover:bg-green-600 transition flex items-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Adding {uploadProgress.current} of {uploadProgress.total}...
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      Upload {validRows.length} Employees
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-4">
              {uploadResults.succeeded.length > 0 && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-center gap-2">
                  <Check size={18} />
                  <span className="font-bold">{uploadResults.succeeded.length}</span> employee{uploadResults.succeeded.length !== 1 ? 's' : ''} added successfully and synced to Salesforce.
                </div>
              )}
              {uploadResults.failed.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertCircle size={18} />
                    {uploadResults.failed.length} employee{uploadResults.failed.length !== 1 ? 's' : ''} failed:
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    {uploadResults.failed.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex justify-end pt-4 border-t">
                <Button
                  onClick={() => {
                    if (uploadResults.succeeded.length > 0) {
                      onSuccess(uploadResults.succeeded);
                    } else {
                      onClose();
                    }
                  }}
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Duplicate Merge Modal Component
const DuplicateMergeModal = ({
  group,
  onClose,
  onMerge,
  onDismiss
}: {
  group: DuplicateGroup;
  onClose: () => void;
  onMerge: (keep: Employee, remove: Employee) => void;
  onDismiss: () => void;
}) => {
  const [selectedToKeep, setSelectedToKeep] = useState<string | number | null>(null);
  const [merging, setMerging] = useState(false);

  const handleMerge = async () => {
    if (!selectedToKeep) return;

    const keepEmployee = group.employees.find(e => e.id === selectedToKeep);
    const removeEmployee = group.employees.find(e => e.id !== selectedToKeep);

    if (keepEmployee && removeEmployee) {
      setMerging(true);
      await onMerge(keepEmployee, removeEmployee);
      setMerging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-boon-dark/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-boon-dark">
              Review Potential Duplicate
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {group.reason} — Select the record to keep
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {group.employees.map((emp) => (
              <div
                key={emp.id}
                onClick={() => setSelectedToKeep(emp.id)}
                className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  selectedToKeep === emp.id
                    ? 'border-boon-blue bg-boon-blue/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-lg text-gray-900">
                    {emp.first_name} {emp.last_name}
                  </span>
                  {selectedToKeep === emp.id && (
                    <span className="text-xs font-bold text-boon-blue bg-boon-blue/10 px-2 py-1 rounded">
                      KEEP
                    </span>
                  )}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Email</span>
                    <span className="text-gray-900 font-medium">{emp.company_email || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Department</span>
                    <span className="text-gray-900">{emp.department || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Job Title</span>
                    <span className="text-gray-900">{emp.job_title || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Program</span>
                    <span className="text-gray-900">{emp.coaching_program || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status</span>
                    <span className={`font-medium ${
                      (emp.status === 'Terminated' || emp.status === 'Inactive' || emp.end_date) ? 'text-red-500' :
                      'text-boon-green'
                    }`}>
                      {(emp.status === 'Terminated' || emp.status === 'Inactive' || emp.end_date) ? 'Terminated' :
                       'Eligible'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {selectedToKeep && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> The other record will be permanently deleted.
                {group.employees.find(e => e.id !== selectedToKeep)?.company_email && (
                  <> Any sessions associated with <strong>{group.employees.find(e => e.id !== selectedToKeep)?.company_email}</strong> will be automatically reassigned to the kept employee.</>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex justify-between items-center bg-gray-50">
          <button
            onClick={onDismiss}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Not a duplicate — Dismiss
          </button>
          <div className="flex gap-3">
            <Button onClick={onClose} variant="ghost">
              Cancel
            </Button>
            <Button
              onClick={handleMerge}
              disabled={!selectedToKeep}
              loading={merging}
            >
              {merging ? 'Merging...' : 'Merge & Delete Duplicate'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;