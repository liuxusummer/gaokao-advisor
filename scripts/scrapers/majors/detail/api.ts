import { HttpClient } from '../../shared/http.js'
import { MAJOR_DETAIL_API_BASE } from '../../config.js'
import type { ApiResponse, CategoryItem, MajorListItem, MajorDetailResponse } from './types.js'

function parseJsonResponse<T>(data: string): ApiResponse<T> {
  const parsed = JSON.parse(data)
  if (!parsed.flag) {
    throw new Error(`API returned flag=false`)
  }
  return parsed as ApiResponse<T>
}

export async function fetchCategories(
  client: HttpClient,
  rootKey: string,
): Promise<CategoryItem[]> {
  const url = `${MAJOR_DETAIL_API_BASE}/mlCategory/${rootKey}`
  const result = await client.fetch(url, {
    cacheKey: `mlCategory_${rootKey}`,
    headers: { Accept: 'application/json' },
  })
  const response = parseJsonResponse<CategoryItem[]>(result.html)
  return response.msg
}

export async function fetchSubcategories(
  client: HttpClient,
  categoryKey: string,
): Promise<CategoryItem[]> {
  const url = `${MAJOR_DETAIL_API_BASE}/xkCategory/${categoryKey}`
  const result = await client.fetch(url, {
    cacheKey: `xkCategory_${categoryKey}`,
    headers: { Accept: 'application/json' },
  })
  const response = parseJsonResponse<CategoryItem[]>(result.html)
  return response.msg
}

export async function fetchMajors(
  client: HttpClient,
  subcategoryKey: string,
): Promise<MajorListItem[]> {
  const url = `${MAJOR_DETAIL_API_BASE}/specialityesByCategory/${subcategoryKey}`
  const result = await client.fetch(url, {
    cacheKey: `specialityesByCategory_${subcategoryKey}`,
    headers: { Accept: 'application/json' },
  })
  const response = parseJsonResponse<MajorListItem[]>(result.html)
  return response.msg
}

export async function fetchMajorDetail(
  client: HttpClient,
  specId: string,
): Promise<MajorDetailResponse> {
  const url = `${MAJOR_DETAIL_API_BASE}/specialityDetail/${specId}`
  const result = await client.fetch(url, {
    cacheKey: `specialityDetail_${specId}`,
    headers: { Accept: 'application/json' },
  })
  const response = parseJsonResponse<MajorDetailResponse>(result.html)
  return response.msg
}
