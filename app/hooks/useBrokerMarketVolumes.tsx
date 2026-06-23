import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import type { API } from "@orderly.network/types";
import { getRuntimeConfig } from "@/utils/runtime-config";

const ORDERLY_PUBLIC_API_URL = "https://api.orderly.org";
const BROKER_MARKET_REFRESH_MS = 60_000;
const DEFAULT_VOLUME_BROKER_ID = "halfmoon";
const DEFAULT_VOLUME_BOOSTER = 1;

type BrokerMarket = Partial<API.MarketInfoExt> & {
  amount?: number | string;
  volume?: number | string;
};

export type BrokerMarketVolumeMap = Map<string, BrokerMarket>;

const BrokerMarketVolumeContext = createContext<BrokerMarketVolumeMap>(new Map());

const getVolumeBrokerId = () => {
  return getRuntimeConfig("VITE_VOLUME_BROKER_ID") || DEFAULT_VOLUME_BROKER_ID;
};

const getVolumeBooster = () => {
  const value = Number(getRuntimeConfig("VITE_VOLUME_BOOSTER"));
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_VOLUME_BOOSTER;
};

const getNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const getRows = (payload: unknown): BrokerMarket[] => {
  if (Array.isArray(payload)) {
    return payload as BrokerMarket[];
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const data = (payload as { data?: unknown }).data;
  const rows = (payload as { rows?: unknown }).rows;

  if (Array.isArray(data)) {
    return data as BrokerMarket[];
  }

  if (data && typeof data === "object" && Array.isArray((data as { rows?: unknown }).rows)) {
    return (data as { rows: BrokerMarket[] }).rows;
  }

  return Array.isArray(rows) ? rows as BrokerMarket[] : [];
};

const toVolumeMap = (rows: BrokerMarket[]): BrokerMarketVolumeMap => {
  return rows.reduce<BrokerMarketVolumeMap>((map, item) => {
    if (item.symbol) {
      map.set(item.symbol, item);
    }
    return map;
  }, new Map());
};

export const applyBrokerMarketVolume = <T extends { symbol?: string } | null | undefined>(
  item: T,
  volumeMap: BrokerMarketVolumeMap,
): T => {
  if (!item?.symbol) {
    return item;
  }

  const brokerMarket = volumeMap.get(item.symbol);
  if (!brokerMarket) {
    return item;
  }

  const booster = getVolumeBooster();
  const volume = getNumber(brokerMarket["24h_volume"] ?? brokerMarket["24h_volumn"] ?? brokerMarket.volume);
  const amount = getNumber(brokerMarket["24h_amount"] ?? brokerMarket.amount);
  const displayAmount = amount ?? volume;

  return {
    ...item,
    ...(volume !== undefined && {
      "24h_volume": volume * booster,
      "24h_volumn": volume * booster,
      volume: volume * booster,
    }),
    ...(displayAmount !== undefined && {
      "24h_amount": displayAmount * booster,
      amount: displayAmount * booster,
    }),
  };
};

export const useBrokerMarketVolumes = () => {
  const brokerId = useMemo(getVolumeBrokerId, []);
  const [volumeMap, setVolumeMap] = useState<BrokerMarketVolumeMap>(() => new Map());

  useEffect(() => {
    let cancelled = false;

    const loadBrokerMarkets = async () => {
      try {
        const url = new URL("/v1/public/futures_market", ORDERLY_PUBLIC_API_URL);
        url.searchParams.set("broker_id", brokerId);

        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error(`Failed to load broker market volume: ${response.status}`);
        }

        const payload = await response.json();
        if (!cancelled) {
          setVolumeMap(toVolumeMap(getRows(payload)));
        }
      } catch (error) {
        console.warn("Failed to load broker-specific market volume", error);
        if (!cancelled) {
          setVolumeMap(new Map());
        }
      }
    };

    loadBrokerMarkets();
    const interval = window.setInterval(loadBrokerMarkets, BROKER_MARKET_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [brokerId]);

  return volumeMap;
};

export const BrokerMarketVolumeProvider = ({
  children,
  volumeMap,
}: {
  children: ReactNode;
  volumeMap: BrokerMarketVolumeMap;
}) => {
  return (
    <BrokerMarketVolumeContext.Provider value={volumeMap}>
      {children}
    </BrokerMarketVolumeContext.Provider>
  );
};

export const useBrokerMarketVolumeMap = () => {
  return useContext(BrokerMarketVolumeContext);
};
