import { useCallback, useMemo } from "react";
import {
  useAccountInstance,
  useEventEmitter,
  useLocalStorage,
  useAccount,
  useConfig,
  useCollateral,
  useMarginRatio,
  usePositionStream,
  useComputedLTV,
} from "@orderly.network/hooks";
import { account } from "@orderly.network/perp";
import { useTranslation } from "@orderly.network/i18n";
import { useDataTap } from "@orderly.network/react-app";
import { AccountStatusEnum, NetworkId } from "@orderly.network/types";
import { modal, toast } from "@orderly.network/ui";
import {
  DepositAndWithdrawWithDialogId,
  TransferDialogId,
} from "@orderly.network/ui-transfer";

export const useAssetViewScript = () => {
  const { t } = useTranslation();
  const account = useAccountInstance();
  const ee = useEventEmitter();

  const { totalValue } = useCollateral({
    dp: 2,
  });

  const networkId = useConfig("networkId") as NetworkId;
  const { state, isMainAccount } = useAccount();
  const { freeCollateral } = useCollateral({
    dp: 2,
  });
  const { marginRatio, currentLeverage, mmr } = useMarginRatio();
  const isConnected = state.status >= AccountStatusEnum.Connected;
  const [{ aggregated, rows }, positionsInfo] = usePositionStream();
  const marginRatioVal = useMemo(() => {
    return Math.min(
      10,
      aggregated.notional === 0
        ? positionsInfo["margin_ratio"](10)!
        : marginRatio,
    );
  }, [marginRatio, aggregated]);

  // const renderMMR = useMemo(() => {
  //   if (!mmr) {
  //     return "";
  //   }
  //   const bigMMR = new Decimal(mmr);
  //   return bigMMR.mul(100).todp(2, 0).toFixed(2);
  // }, [mmr]);

  const openDepositAndWithdraw = useCallback(
    (viewName: "deposit" | "withdraw") => {
      // desktop always show dialog
      return modal.show(DepositAndWithdrawWithDialogId, {
        activeTab: viewName,
      });
    },
    [],
  );

  const onDeposit = useCallback(async () => {
    return openDepositAndWithdraw("deposit");
  }, []);

  const onWithdraw = useCallback(async () => {
    return openDepositAndWithdraw("withdraw");
  }, []);

  const onTransfer = useCallback(async () => {
    return modal.show(TransferDialogId);
  }, []);

  const onSettle = useCallback(async () => {
    return account
      .settle()
      .catch((e) => {
        if (e.code === -1104) {
          toast.error(t("settle.settlement.error"));
          return Promise.reject(e);
        }
        if (
          e.message.indexOf(
            "Signing off chain messages with Ledger is not yet supported",
          ) !== -1
        ) {
          ee.emit("wallet:sign-message-with-ledger-error", {
            message: e.message,
            userAddress: account.address,
          });
        }
      })
      .then((res) => {
        toast.success(t("settle.settlement.requested"));
        return Promise.resolve(res);
      });
  }, [account, t]);

  const [visible, setVisible] = useLocalStorage<boolean>(
    "orderly_assets_visible",
    true,
  );

  const toggleVisible = useCallback(() => {
    // @ts-ignore
    setVisible((visible: boolean) => {
      return !visible;
    });
  }, [visible]);

  const totalMM = useMemo(() => {
    return rows?.reduce((sum, pos) => sum + (pos.mm || 0), 0) || 0;
  }, [rows]);


  const currentLtv = useComputedLTV();

  const _currentLtv = useDataTap(currentLtv) ?? undefined;
  const _freeCollateral = useDataTap(freeCollateral) ?? undefined;
  const _marginRatioVal = useDataTap(marginRatioVal) ?? undefined;
  const _mmr = useDataTap(mmr) ?? undefined;
  const _totalValue = useDataTap(totalValue) ?? undefined;
  const _unrealPnL = aggregated?.total_unreal_pnl ?? undefined;
  const _totalMM = useDataTap(totalMM) ?? undefined;
  const _currentLeverage = useDataTap(currentLeverage) ?? undefined;


  return {
    onDeposit,
    onWithdraw,
    onTransfer,
    onSettle,
    visible,
    toggleVisible,
    networkId,
    totalValue: _totalValue,
    status: state.status,
    freeCollateral: _freeCollateral,
    marginRatioVal: _marginRatioVal,
    renderMMR: _mmr,
    isConnected,
    isMainAccount,
    hasSubAccount: !!state.subAccounts?.length,
    currentLtv: _currentLtv,
    unrealPnL: _unrealPnL,
    totalMM: _totalMM,
    currentLeverage: _currentLeverage,
  };
};

export type AssetViewState = ReturnType<typeof useAssetViewScript>;
