import { StatementType } from "@/lib/services/protocol";

const API_BASE_URL = "http://localhost:8000";

export interface ConceptNormalizationOverride {
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
  axis: string;
  member: string;
  member_label: string;
  normalized_axis_label: string;
  normalized_member_label?: string | null;
  tags?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export class AdminService {
  /**
   * List all concept normalization overrides, optionally filtered by statement
   */
  static async listOverrides(
    statement?: StatementType
  ): Promise<ConceptNormalizationOverride[]> {
    const url = new URL(
      `${API_BASE_URL}/admin/concept-normalization-overrides`
    );
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
   * Get a single override by concept and statement
   */
  static async getOverride(
    concept: string,
    statement: StatementType
  ): Promise<ConceptNormalizationOverride> {
    const encodedConcept = encodeURIComponent(concept);
    const encodedStatement = encodeURIComponent(statement);
    const url = `${API_BASE_URL}/admin/concept-normalization-overrides/${encodedStatement}/${encodedConcept}`;

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Override not found");
      }
      throw new Error(`Failed to fetch override: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create a new override
   */
  static async createOverride(
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
  static async updateOverride(
    concept: string,
    statement: StatementType,
    override: Partial<
      Omit<ConceptNormalizationOverride, "concept" | "statement">
    >
  ): Promise<ConceptNormalizationOverride> {
    const encodedConcept = encodeURIComponent(concept);
    const encodedStatement = encodeURIComponent(statement);
    const url = `${API_BASE_URL}/admin/concept-normalization-overrides/${encodedStatement}/${encodedConcept}`;

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
  static async deleteOverride(
    concept: string,
    statement: StatementType
  ): Promise<void> {
    const encodedConcept = encodeURIComponent(concept);
    const encodedStatement = encodeURIComponent(statement);
    const url = `${API_BASE_URL}/admin/concept-normalization-overrides/${encodedStatement}/${encodedConcept}`;

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
  static async exportOverrides(statement?: StatementType): Promise<Blob> {
    const url = new URL(
      `${API_BASE_URL}/admin/concept-normalization-overrides/export`
    );
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
  static async importOverrides(
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
   * List all dimension normalization overrides, optionally filtered by axis
   */
  static async listDimensionOverrides(
    axis?: string
  ): Promise<DimensionNormalizationOverride[]> {
    const url = new URL(
      `${API_BASE_URL}/admin/dimension-normalization-overrides`
    );
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
    const url = `${API_BASE_URL}/admin/dimension-normalization-overrides/${encodedAxis}/${encodedMember}/${encodedMemberLabel}`;

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
    axis: string,
    member: string,
    memberLabel: string
  ): Promise<void> {
    const encodedAxis = encodeURIComponent(axis);
    const encodedMember = encodeURIComponent(member);
    const encodedMemberLabel = encodeURIComponent(memberLabel);
    const url = `${API_BASE_URL}/admin/dimension-normalization-overrides/${encodedAxis}/${encodedMember}/${encodedMemberLabel}`;

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
}
