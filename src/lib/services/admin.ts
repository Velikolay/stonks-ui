import { StatementType } from "@/lib/services/protocol";

const API_BASE_URL = "http://localhost:8000";

export interface ConceptNormalizationOverride {
  company_id: number;
  concept: string;
  statement: StatementType;
  normalized_label: string;
  is_abstract: boolean;
  parent_concept?: string | null;
  abstract_concept?: string | null;
  weight?: number | null;
  unit?: string | null;
  description?: string | null;
  updated_at?: string | null;
}

export interface ImportSummary {
  created: number;
  updated: number;
  errors: Array<{
    row: number;
    message: string;
  }>;
}

export interface DimensionNormalizationOverride {
  company_id: number;
  axis: string;
  member: string;
  member_label: string;
  normalized_axis_label: string;
  normalized_member_label?: string | null;
  tags?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface TickerResponse {
  id: number;
  ticker: string;
  exchange: string;
  status: string;
}

export interface FilingEntityResponse {
  id: number;
  registry: string;
  number: string;
  status: string;
}

export interface CompanyResponse {
  id: number;
  name: string;
  industry?: string | null;
  tickers: TickerResponse[];
  filing_entities: FilingEntityResponse[];
}

export interface CompanyUpdate {
  name?: string;
  industry?: string | null;
}

export interface TickerCreate {
  ticker: string;
  exchange: string;
  status: string;
}

export interface TickerUpdate {
  ticker?: string;
  exchange?: string;
  status?: string;
}

export interface FilingEntityCreate {
  registry: string;
  number: string;
  status: string;
}

export interface FilingEntityUpdate {
  registry?: string;
  number?: string;
  status?: string;
}

export class AdminService {
  /**
   * List all concept normalization overrides, optionally filtered by statement
   */
  static async listConceptOverrides(
    companyId: number,
    statement?: StatementType
  ): Promise<ConceptNormalizationOverride[]> {
    const url = new URL(
      `${API_BASE_URL}/admin/concept-normalization-overrides`
    );
    url.searchParams.set("company_id", companyId.toString());
    if (statement) {
      url.searchParams.set("statement", statement);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Failed to fetch overrides: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create a new override
   */
  static async createConceptOverride(
    override: Omit<ConceptNormalizationOverride, "concept" | "statement"> & {
      concept: string;
      statement: StatementType;
    }
  ): Promise<ConceptNormalizationOverride> {
    const response = await fetch(
      `${API_BASE_URL}/admin/concept-normalization-overrides`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(override),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to create override: ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  }

  /**
   * Update an existing override
   */
  static async updateConceptOverride(
    companyId: number,
    concept: string,
    statement: StatementType,
    override: Partial<
      Omit<ConceptNormalizationOverride, "concept" | "statement">
    >
  ): Promise<ConceptNormalizationOverride> {
    const encodedConcept = encodeURIComponent(concept);
    const encodedStatement = encodeURIComponent(statement);
    const url = `${API_BASE_URL}/admin/concept-normalization-overrides/${companyId}/${encodedStatement}/${encodedConcept}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(override),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to update override: ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  }

  /**
   * Delete an override
   */
  static async deleteConceptOverride(
    companyId: number,
    concept: string,
    statement: StatementType
  ): Promise<void> {
    const encodedConcept = encodeURIComponent(concept);
    const encodedStatement = encodeURIComponent(statement);
    const url = `${API_BASE_URL}/admin/concept-normalization-overrides/${companyId}/${encodedStatement}/${encodedConcept}`;

    const response = await fetch(url, {
      method: "DELETE",
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Override not found");
      }
      throw new Error(`Failed to delete override: ${response.statusText}`);
    }
  }

  /**
   * Export overrides as CSV
   */
  static async exportConceptOverrides(
    statement?: StatementType,
    companyId?: number
  ): Promise<Blob> {
    const url = new URL(
      `${API_BASE_URL}/admin/concept-normalization-overrides/export`
    );
    if (companyId) {
      url.searchParams.set("company_id", companyId.toString());
    }
    if (statement) {
      url.searchParams.set("statement", statement);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Failed to export overrides: ${response.statusText}`);
    }

    return response.blob();
  }

  /**
   * Import overrides from CSV
   */
  static async importConceptOverrides(
    file: File,
    updateExisting: boolean = false
  ): Promise<ImportSummary> {
    const formData = new FormData();
    formData.append("file", file);

    const url = new URL(
      `${API_BASE_URL}/admin/concept-normalization-overrides/import`
    );
    url.searchParams.set("update_existing", updateExisting.toString());

    const response = await fetch(url.toString(), {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to import overrides: ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  }

  /**
   * List all dimension normalization overrides, optionally filtered by axis
   */
  static async listDimensionOverrides(
    companyId: number,
    axis?: string
  ): Promise<DimensionNormalizationOverride[]> {
    const url = new URL(
      `${API_BASE_URL}/admin/dimension-normalization-overrides`
    );
    url.searchParams.set("company_id", companyId.toString());
    if (axis) {
      url.searchParams.set("axis", axis);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Failed to fetch overrides: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create a new dimension normalization override
   */
  static async createDimensionOverride(
    override: Omit<DimensionNormalizationOverride, "created_at" | "updated_at">
  ): Promise<DimensionNormalizationOverride> {
    const response = await fetch(
      `${API_BASE_URL}/admin/dimension-normalization-overrides`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(override),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to create override: ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  }

  /**
   * Update an existing dimension normalization override
   */
  static async updateDimensionOverride(
    companyId: number,
    axis: string,
    member: string,
    memberLabel: string,
    override: Partial<
      Omit<
        DimensionNormalizationOverride,
        "axis" | "member" | "member_label" | "created_at" | "updated_at"
      >
    >
  ): Promise<DimensionNormalizationOverride> {
    const encodedAxis = encodeURIComponent(axis);
    const encodedMember = encodeURIComponent(member);
    const encodedMemberLabel = encodeURIComponent(memberLabel);
    const url = `${API_BASE_URL}/admin/dimension-normalization-overrides/${companyId}/${encodedAxis}/${encodedMember}/${encodedMemberLabel}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(override),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to update override: ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  }

  /**
   * Delete a dimension normalization override
   */
  static async deleteDimensionOverride(
    companyId: number,
    axis: string,
    member: string,
    memberLabel: string
  ): Promise<void> {
    const encodedAxis = encodeURIComponent(axis);
    const encodedMember = encodeURIComponent(member);
    const encodedMemberLabel = encodeURIComponent(memberLabel);
    const url = `${API_BASE_URL}/admin/dimension-normalization-overrides/${companyId}/${encodedAxis}/${encodedMember}/${encodedMemberLabel}`;

    const response = await fetch(url, {
      method: "DELETE",
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Override not found");
      }
      throw new Error(`Failed to delete override: ${response.statusText}`);
    }
  }

  /**
   * Export dimension normalization overrides as CSV
   */
  static async exportDimensionOverrides(axis?: string): Promise<Blob> {
    const url = new URL(
      `${API_BASE_URL}/admin/dimension-normalization-overrides/export`
    );
    if (axis) {
      url.searchParams.set("axis", axis);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Failed to export overrides: ${response.statusText}`);
    }

    return response.blob();
  }

  /**
   * Import dimension normalization overrides from CSV
   */
  static async importDimensionOverrides(
    file: File,
    updateExisting: boolean = false
  ): Promise<ImportSummary> {
    const formData = new FormData();
    formData.append("file", file);

    const url = new URL(
      `${API_BASE_URL}/admin/dimension-normalization-overrides/import`
    );
    url.searchParams.set("update_existing", updateExisting.toString());

    const response = await fetch(url.toString(), {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to import overrides: ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  }

  /**
   * Refresh financials data
   */
  static async refreshFinancials(concurrent: boolean = true): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/admin/financials/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ concurrent }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to refresh financials: ${response.statusText} - ${errorText}`
      );
    }
  }

  /**
   * List all companies with managed relationships (tickers + filing entities)
   */
  static async listCompanies(): Promise<CompanyResponse[]> {
    const response = await fetch(`${API_BASE_URL}/admin/companies`);
    if (!response.ok) {
      throw new Error(`Failed to fetch companies: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Update a company (name/industry)
   */
  static async updateCompany(
    companyId: number,
    companyUpdate: CompanyUpdate
  ): Promise<CompanyResponse> {
    const response = await fetch(
      `${API_BASE_URL}/admin/companies/${companyId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(companyUpdate),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to update company: ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  }

  /**
   * Add a ticker for a company
   */
  static async addCompanyTicker(
    companyId: number,
    ticker: TickerCreate
  ): Promise<TickerResponse> {
    const response = await fetch(
      `${API_BASE_URL}/admin/companies/${companyId}/tickers`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ticker),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to add company ticker: ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  }

  /**
   * Update a company ticker
   */
  static async updateCompanyTicker(
    companyId: number,
    tickerId: number,
    tickerUpdate: TickerUpdate
  ): Promise<TickerResponse> {
    const response = await fetch(
      `${API_BASE_URL}/admin/companies/${companyId}/tickers/${tickerId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(tickerUpdate),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to update company ticker: ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  }

  /**
   * Delete a company ticker
   */
  static async deleteCompanyTicker(
    companyId: number,
    tickerId: number
  ): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/admin/companies/${companyId}/tickers/${tickerId}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to delete company ticker: ${response.statusText} - ${errorText}`
      );
    }
  }

  /**
   * Add a filing entity for a company
   */
  static async addCompanyFilingEntity(
    companyId: number,
    filingEntity: FilingEntityCreate
  ): Promise<FilingEntityResponse> {
    const response = await fetch(
      `${API_BASE_URL}/admin/companies/${companyId}/filing-entities`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(filingEntity),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to add company filing entity: ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  }

  /**
   * Update a company filing entity
   */
  static async updateCompanyFilingEntity(
    companyId: number,
    filingEntityId: number,
    filingEntityUpdate: FilingEntityUpdate
  ): Promise<FilingEntityResponse> {
    const response = await fetch(
      `${API_BASE_URL}/admin/companies/${companyId}/filing-entities/${filingEntityId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(filingEntityUpdate),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to update company filing entity: ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  }

  /**
   * Delete a company filing entity
   */
  static async deleteCompanyFilingEntity(
    companyId: number,
    filingEntityId: number
  ): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/admin/companies/${companyId}/filing-entities/${filingEntityId}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to delete company filing entity: ${response.statusText} - ${errorText}`
      );
    }
  }
}
