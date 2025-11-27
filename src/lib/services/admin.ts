const API_BASE_URL = "http://localhost:8000";

export type StatementType =
  | "Income Statement"
  | "Balance Sheet"
  | "Cash Flow Statement";

export interface ConceptNormalizationOverride {
  concept: string;
  statement: StatementType;
  normalized_label: string;
  is_abstract: boolean;
  parent_concept?: string | null;
  description?: string | null;
  aggregation?: "SUM_GROUP" | null;
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
}
