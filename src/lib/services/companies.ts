const API_BASE_URL = "http://localhost:8000";

export interface CompanySearchResponse {
  id: number;
  name: string;
  ticker?: string | null;
}

export class CompaniesService {
  /**
   * Search companies by name or ticker prefix
   */
  static async searchCompanies(
    prefix: string,
    limit: number = 20
  ): Promise<CompanySearchResponse[]> {
    const url = new URL(`${API_BASE_URL}/companies/search`);
    url.searchParams.set("prefix", prefix);
    url.searchParams.set("limit", Math.min(20, Math.max(1, limit)).toString());

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Failed to search companies: ${response.statusText}`);
    }
    return response.json();
  }
}
