/**
 * 号码管理 API
 */
import { get, post, put, del, ApiResponse } from '../../utils/request';

// 号码接口
export interface PhoneNumber {
  id: number;
  phoneNumber: string;
  displayName?: string;
  isPrimary: boolean;
  schemeId?: number;
  schemeName?: string;
  forwardingEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 获取号码列表
 */
export const getPhoneNumbers = (): Promise<ApiResponse<PhoneNumber[]>> => {
  return get('/phone-numbers');
};

/**
 * 创建号码
 */
export const createPhoneNumber = (data: Partial<PhoneNumber>): Promise<ApiResponse<PhoneNumber>> => {
  return post('/phone-numbers', data);
};

/**
 * 更新号码
 */
export const updatePhoneNumber = (id: number, data: Partial<PhoneNumber>): Promise<ApiResponse<PhoneNumber>> => {
  return put(`/phone-numbers/${id}`, data);
};

/**
 * 删除号码
 */
export const deletePhoneNumber = (id: number): Promise<ApiResponse<null>> => {
  return del(`/phone-numbers/${id}`);
};

/**
 * 设置主号码
 */
export const setPrimaryPhoneNumber = (id: number): Promise<ApiResponse<null>> => {
  return post(`/phone-numbers/${id}/set-primary`);
};

/**
 * 绑定方案
 */
export const bindScheme = (numberId: number, schemeId: number): Promise<ApiResponse<null>> => {
  return post(`/phone-numbers/${numberId}/bind-scheme`, { schemeId });
};

/**
 * 解绑方案
 */
export const unbindScheme = (numberId: number): Promise<ApiResponse<null>> => {
  return post(`/phone-numbers/${numberId}/unbind-scheme`);
};
