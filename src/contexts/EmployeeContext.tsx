import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import type { Employee, PerformanceRating } from '../lib/types';
import {
  listEmployees,
  getLatestRating,
  type EmployeeFilter,
} from '../lib/tauri-commands';

// =============================================================================
// Types
// =============================================================================

interface EmployeeWithLatestRating extends Employee {
  latestRating?: PerformanceRating;
}

interface EmployeeContextValue {
  // Data
  employees: EmployeeWithLatestRating[];
  selectedEmployeeId: string | null;
  selectedEmployee: EmployeeWithLatestRating | null;
  totalCount: number;

  // Loading states
  isLoading: boolean;
  isLoadingRatings: boolean;
  error: string | null;

  // Filters
  filter: EmployeeFilter;
  searchQuery: string;

  // Modal states
  isEditModalOpen: boolean;
  isImportWizardOpen: boolean;

  // Actions
  selectEmployee: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setFilter: (filter: EmployeeFilter) => void;
  refreshEmployees: () => Promise<void>;
  openEditModal: () => void;
  closeEditModal: () => void;
  updateEmployeeInList: (updated: Employee) => void;
  openImportWizard: () => void;
  closeImportWizard: () => void;
}

// =============================================================================
// Context
// =============================================================================

const EmployeeContext = createContext<EmployeeContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

interface EmployeeProviderProps {
  children: ReactNode;
}

export function EmployeeProvider({ children }: EmployeeProviderProps) {
  // Core state
  const [employees, setEmployees] = useState<EmployeeWithLatestRating[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRatings, setIsLoadingRatings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filter, setFilter] = useState<EmployeeFilter>({});
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);

  // Derived: currently selected employee
  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId) ?? null;

  // Fetch employees from backend
  const refreshEmployees = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Build filter with search query
      const effectiveFilter: EmployeeFilter = {
        ...filter,
        search: searchQuery || undefined,
      };

      const result = await listEmployees(effectiveFilter, 200, 0);

      // Start with employees without ratings
      setEmployees(result.employees);
      setTotalCount(result.total);
      setIsLoading(false);

      // Fetch ratings in background (don't block UI)
      setIsLoadingRatings(true);

      const employeesWithRatings = await Promise.all(
        result.employees.map(async (emp) => {
          try {
            const rating = await getLatestRating(emp.id);
            return { ...emp, latestRating: rating ?? undefined };
          } catch {
            // If rating fetch fails, just return employee without rating
            return emp;
          }
        })
      );

      setEmployees(employeesWithRatings);
      setIsLoadingRatings(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employees');
      setIsLoading(false);
      setIsLoadingRatings(false);
    }
  }, [filter, searchQuery]);

  // Select an employee
  const selectEmployee = useCallback((id: string | null) => {
    setSelectedEmployeeId(id);
  }, []);

  // Edit modal controls
  const openEditModal = useCallback(() => {
    setIsEditModalOpen(true);
  }, []);

  const closeEditModal = useCallback(() => {
    setIsEditModalOpen(false);
  }, []);

  // Update employee in local list (after edit)
  const updateEmployeeInList = useCallback((updated: Employee) => {
    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id === updated.id ? { ...updated, latestRating: emp.latestRating } : emp
      )
    );
  }, []);

  // Import wizard controls
  const openImportWizard = useCallback(() => {
    setIsImportWizardOpen(true);
  }, []);

  const closeImportWizard = useCallback(() => {
    setIsImportWizardOpen(false);
  }, []);

  // Load employees on mount and when filters change
  useEffect(() => {
    refreshEmployees();
  }, [refreshEmployees]);

  // Context value
  const value: EmployeeContextValue = {
    employees,
    selectedEmployeeId,
    selectedEmployee,
    totalCount,
    isLoading,
    isLoadingRatings,
    error,
    filter,
    searchQuery,
    isEditModalOpen,
    isImportWizardOpen,
    selectEmployee,
    setSearchQuery,
    setFilter,
    refreshEmployees,
    openEditModal,
    closeEditModal,
    updateEmployeeInList,
    openImportWizard,
    closeImportWizard,
  };

  return (
    <EmployeeContext.Provider value={value}>
      {children}
    </EmployeeContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useEmployees() {
  const context = useContext(EmployeeContext);
  if (!context) {
    throw new Error('useEmployees must be used within an EmployeeProvider');
  }
  return context;
}

export default EmployeeContext;
