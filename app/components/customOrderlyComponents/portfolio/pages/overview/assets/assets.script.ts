import { useCallback, useMemo } from "react";
import {
  useAccount,
  useCollateral,
  useLeverage,
  useLocalStorage,
  usePositionStream,
  useWalletConnector,
  usePrivateQuery,
  useDaily,
  useAssetsHistory,
  useIndexPricesStream
} from "@orderly.network/hooks";
import { useAppContext } from "@orderly.network/react-app";
import { AccountStatusEnum } from "@orderly.network/types";
import { modal, useScreen } from "@orderly.network/ui";
import { LeverageWidgetWithDialogId } from "@orderly.network/ui-leverage";
import {
  DepositAndWithdrawWithDialogId,
  DepositAndWithdrawWithSheetId,
  TransferDialogId,
  TransferSheetId,
} from "@orderly.network/ui-transfer";
import { API } from "@orderly.network/types";
import { Decimal, zero } from "@orderly.network/utils";

export const useAssetScript = () => {
  const { connect, namespace } = useWalletConnector();
  const { state, isMainAccount } = useAccount();
  const { totalValue, freeCollateral } = useCollateral();
  const { wrongNetwork, disabledConnect } = useAppContext();
  const [data] = usePositionStream();
  const { curLeverage } = useLeverage();
  const [visible, setVisible] = useLocalStorage("orderly_assets_visible", true);
  const { isMobile } = useScreen();
  const handleDomId = isMobile
    ? DepositAndWithdrawWithSheetId
    : DepositAndWithdrawWithDialogId;
  const subAccounts = state.subAccounts ?? [];

  const canTrade = useMemo(() => {
    return (
      !wrongNetwork &&
      !disabledConnect &&
      (state.status === AccountStatusEnum.EnableTrading ||
        state.status === AccountStatusEnum.EnableTradingWithoutConnected)
    );
  }, [state.status, wrongNetwork, disabledConnect]);

  const onLeverageEdit = () => {
    modal.show(LeverageWidgetWithDialogId);
  };

  const onDeposit = useCallback(() => {
    modal.show(handleDomId, { activeTab: "deposit" });
  }, [handleDomId]);

  const onWithdraw = useCallback(() => {
    modal.show(handleDomId, { activeTab: "withdraw" });
  }, []);

  const onTransfer = useCallback(() => {
    if (isMobile) {
      modal.show(TransferSheetId);
    } else {
      modal.show(TransferDialogId);
    }
  }, [isMobile]);

  const { data: volumeStatistics } = usePrivateQuery<{
    perp_volume_last_7_days: number;
    perp_volume_last_30_days: number;
    perp_volume_ltd: number; // All-time trading volume  
  }>("/v1/volume/user/stats");

  const { data: dailyVolume } = useDaily({
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday  
    endDate: new Date(),   // Today    
  });
  const todayVolume = dailyVolume?.find(item => {
    const today = new Date().toISOString().split('T')[0];
    return item.date === today;
  })?.perp_volume;

  const { data: positionHistory } = usePrivateQuery<API.PositionHistory[]>(
    "/v1/position_history?limit=1000",
    {
      formatter(data) {
        return data.rows ?? [];
      },
    }
  );

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0); // Start of day  

  const today = new Date();
  today.setHours(23, 59, 59, 999); // End of day
  // Filter positions for last 30 days  
  const positionsLast30Days = positionHistory?.filter(item => {
    const time = item?.last_update_time ?? item.open_timestamp;
    const positionDate = new Date(time);
    return positionDate >= thirtyDaysAgo && positionDate <= today;
  });

  // Total profit from positions  
  const totalProfit = positionsLast30Days?.reduce((sum, position) => {
    const netPnL = position.realized_pnl -
      position.accumulated_funding_fee -
      position.trading_fee;
    return sum + (netPnL || 0);
  }, 0) || 0;


  const positionWithLowestPnL = (positionsLast30Days && positionsLast30Days.length > 0) ? positionsLast30Days.reduce((lowest, position) => {
    // Calculate net PNL for current position  
    const currentNetPnL = position.realized_pnl -
      position.accumulated_funding_fee -
      position.trading_fee;

    // Calculate net PNL for current lowest position  
    const lowestNetPnL = lowest.realized_pnl -
      lowest.accumulated_funding_fee -
      lowest.trading_fee;

    // Return position with lower PNL (more negative)  
    return currentNetPnL < lowestNetPnL ? position : lowest;
  }) : undefined;

  // Get the actual lowest PNL value  
  const lowestPnLValue = positionWithLowestPnL ?
    positionWithLowestPnL.realized_pnl -
    positionWithLowestPnL.accumulated_funding_fee -
    positionWithLowestPnL.trading_fee : 0;

  const [allDepositHistory] = useAssetsHistory({
    side: "DEPOSIT",
    startTime: thirtyDaysAgo.getTime(),
    endTime: today.getTime(),
    pageSize: 200,
  });


  const [allWithdrawalHistory] = useAssetsHistory({
    side: "WITHDRAW",
    startTime: thirtyDaysAgo.getTime(),
    endTime: today.getTime(),
    pageSize: 200,
  });


  const { getIndexPrice } = useIndexPricesStream();
  const convertToUSDCAndOperate = useCallback(
    (inputs: {
      token: string;
      amount: string | number;
      value: Decimal;
      op?: "add" | "sub";
    }): Decimal => {
      const { token, amount, value, op = "sub" } = inputs;
      if (token.toUpperCase() === "USDC") {
        return op === "add" ? value.add(amount) : value.sub(amount);
      } else {
        const indexPrice = getIndexPrice(token);
        if (indexPrice) {
          const delta = new Decimal(amount).mul(indexPrice);
          return op === "add" ? value.add(delta) : value.sub(delta);
        }
        return value;
      }
    },
    [getIndexPrice],
  );

  const totalDeposits = allDepositHistory
    ?.filter((item) => item.trans_status === "COMPLETED")
    .reduce((acc, item) => {
      return acc.add(
        convertToUSDCAndOperate({
          token: item.token,
          amount: item.amount,
          value: zero,
          op: "add",
        }),
      );
    }, zero);

  const totalWithdrawals = allWithdrawalHistory
    ?.filter((item) => item.trans_status === "COMPLETED")
    .reduce((acc, item) => {
      return acc.add(
        convertToUSDCAndOperate({
          token: item.token,
          amount: item.amount,
          value: zero,
          op: "add",
        }),
      );
    }, zero);

  return {
    canTrade,
    connect,
    portfolioValue: totalValue,
    freeCollateral,
    unrealPnL: data.aggregated.total_unreal_pnl,
    unrealROI: data.totalUnrealizedROI,
    currentLeverage: curLeverage,
    onLeverageEdit,
    visible,
    wrongNetwork,
    toggleVisible: () => setVisible(!visible),
    onDeposit,
    onWithdraw,
    onTransfer,
    namespace,
    isMainAccount,
    hasSubAccount: subAccounts?.length > 0,
    perpTradingVolume: (todayVolume ?? 0) + (volumeStatistics?.perp_volume_ltd ?? 0),
    dailyVolume: todayVolume,
    totalProfit: totalProfit,
    maxDrawdown: lowestPnLValue,
    totalDeposit: totalDeposits,
    totalWithdrawal: totalWithdrawals,
  } as const;
};

export type AssetScriptReturn = ReturnType<typeof useAssetScript>;
