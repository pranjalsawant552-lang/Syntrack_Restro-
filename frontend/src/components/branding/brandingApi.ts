import axiosClient from "../axiosData/axiosClient";

export type Branding = { appName: string; logoUrl: string };

const pickData = (res: any) => res?.data?.data ?? res?.data;

export const brandingApi = {
  // For an already-authenticated user.
  getMine: async (): Promise<Branding> => {
    const res = await axiosClient.get(`/branding`);
    return pickData(res) as Branding;
  },

  // For the login screen, before authentication. slug is optional.
  getPublic: async (slug?: string): Promise<Branding> => {
    const res = await axiosClient.get(`/branding/public`, { params: slug ? { slug } : {} });
    return pickData(res) as Branding;
  },

  update: async (payload: Partial<Branding>): Promise<Branding> => {
    const res = await axiosClient.put(`/branding`, payload);
    return pickData(res) as Branding;
  },

  uploadLogo: async (file: File): Promise<{ logoUrl: string }> => {
    const form = new FormData();
    form.append("file", file);
    const res = await axiosClient.post(`/branding/logo`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return pickData(res);
  },
};
