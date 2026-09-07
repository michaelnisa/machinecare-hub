import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { connectedDataService } from "@/services/connectedDataService";

export function useConnectedCustomers() {
  return useQuery({
    queryKey: ["connected-customers"],
    queryFn: () => connectedDataService.getCustomers(),
    staleTime: 30000,
  });
}

export function useConnectedSites(customerId?: string) {
  return useQuery({
    queryKey: ["connected-sites", customerId],
    queryFn: () => connectedDataService.getSites(customerId),
    staleTime: 30000,
  });
}

export function useConnectedAssets(customerId?: string) {
  return useQuery({
    queryKey: ["connected-assets", customerId],
    queryFn: () => connectedDataService.getAssets(customerId),
    staleTime: 15000,
  });
}

export function useConnectedDevices() {
  return useQuery({
    queryKey: ["connected-devices"],
    queryFn: () => connectedDataService.getDevices(),
    staleTime: 30000,
  });
}

export function useConnectedDataSources() {
  return useQuery({
    queryKey: ["connected-data-sources"],
    queryFn: () => connectedDataService.getDataSources(),
    staleTime: 30000,
  });
}

export function useConnectedEvents() {
  return useQuery({
    queryKey: ["connected-events"],
    queryFn: () => connectedDataService.getEvents(),
    refetchInterval: 10000,
  });
}

export function useConnectedApiKeys() {
  return useQuery({
    queryKey: ["connected-api-keys"],
    queryFn: () => connectedDataService.getApiKeys(),
    staleTime: 60000,
  });
}

export function useConnectedWebhooks() {
  return useQuery({
    queryKey: ["connected-webhooks"],
    queryFn: () => connectedDataService.getWebhooks(),
    staleTime: 60000,
  });
}

export function useConnectedDataQuality() {
  return useQuery({
    queryKey: ["connected-data-quality"],
    queryFn: () => connectedDataService.getDataQualityRecords(),
    staleTime: 30000,
  });
}
