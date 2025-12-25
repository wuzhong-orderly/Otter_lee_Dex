import React, { FC, ReactNode } from "react";
import { useTranslation } from "@orderly.network/i18n";
import {
  Card,
  Divider,
  Flex,
  Grid,
  Either,
  Statistic,
  Text,
  EyeIcon,
  gradientTextVariants,
  EditIcon,
  EyeCloseIcon,
  Tooltip,
  cn,
} from "@orderly.network/ui";
import { AuthGuard } from "@orderly.network/ui-connector";
import { AssetScriptReturn } from "./assets.script";
import { AssetsHeader } from "./assetsHeader";

export const AssetsUI: React.FC<
  AssetScriptReturn & { onConnectWallet?: () => void }
> = (props) => {
  const { t } = useTranslation();
  return (
    <Card
      classNames={{ footer: "oui-h-[48px]", root: "oui-h-auto oui-min-h-[240px]" }}
      title={
        <AssetsHeader
          disabled={!props.canTrade}
          isMainAccount={props.isMainAccount}
          onDeposit={props.onDeposit}
          onWithdraw={props.onWithdraw}
          onTransfer={props.onTransfer}
          hasSubAccount={props.hasSubAccount}
        />
      }
    >
      <>
        <Statistic
          label={
            <Flex gap={1}>
              <Text intensity={54}>{t("common.totalValue")}</Text>
              <button
                onClick={() => {
                  props.toggleVisible();
                }}
                data-testid="oui-testid-portfolio-assets-eye-btn"
              >
                {props.visible ? (
                  <EyeIcon size={16} color={"white"} />
                ) : (
                  <EyeCloseIcon size={16} color={"white"} />
                )}
              </button>
            </Flex>
          }
        >
          <Either value={props.canTrade!} left={<NoValue />}>
            <Text.numeral
              visible={props.visible}
              unit="USDC"
              // @ts-ignore
              style={{ "--oui-gradient-angle": "45deg" }}
              unitClassName="oui-text-base oui-text-base-contrast-80 oui-h-9 oui-ml-1"
              className={gradientTextVariants({
                className: "oui-font-bold oui-text-3xl",
                color: "brand",
              })}
            >
              {props.portfolioValue ?? "--"}
            </Text.numeral>
          </Either>
        </Statistic>
        <Divider className="oui-my-4" intensity={8} />
        <AuthGuard buttonProps={{ size: "lg", fullWidth: true }}>
          <AssetStatistic
            unrealROI={props.unrealROI}
            unrealPnL={props.unrealPnL}
            freeCollateral={props.freeCollateral}
            currentLeverage={props.currentLeverage}
            onLeverageEdit={props.onLeverageEdit}
            visible={props.visible}
            perpTradingVolume={props.perpTradingVolume}
            dailyVolume={props.dailyVolume}
            totalProfit={props.totalProfit}
            maxDrawdown={props.maxDrawdown}
            totalDeposit={props.totalDeposit}
            totalWithdrawal={props.totalWithdrawal}
          />
        </AuthGuard>
      </>
    </Card>
  );
};

const NoValue: FC = () => {
  return (
    <Flex gap={1} className={"oui-h-9"}>
      <Text.gradient color="brand" weight="bold">
        --
      </Text.gradient>
      <Text>USDC</Text>
    </Flex>
  );
};

type AssetStatisticProps = Pick<
  AssetScriptReturn,
  | "currentLeverage"
  | "unrealPnL"
  | "unrealROI"
  | "freeCollateral"
  | "onLeverageEdit"
  | "visible"
  | "perpTradingVolume"
  | "dailyVolume"
  | "totalProfit"
  | "maxDrawdown"
  | "totalDeposit"
  | "totalWithdrawal"
>;

export const AssetStatistic = (props: AssetStatisticProps) => {
  const { t } = useTranslation();

  return (
    <div className="oui-space-y-4">
      <Grid cols={2} className="oui-h-12">
        <Statistic label={t("common.unrealizedPnl")}>
          <Flex>
            <Text.pnl
              coloring
              size="lg"
              weight="semibold"
              visible={props.visible}
            >
              {props.unrealPnL}
            </Text.pnl>
            <Text.roi
              coloring
              rule="percentages"
              size="sm"
              weight="semibold"
              prefix={"("}
              suffix={")"}
              visible={props.visible}
            >
              {props.unrealROI}
            </Text.roi>
          </Flex>
        </Statistic>
        <Statistic
          label={t("portfolio.overview.availableWithdraw")}
          // @ts-ignore
          align="right"
          // @ts-ignore
          valueProps={{ size: "lg", visible: props.visible }}
        >
          {props.freeCollateral}
        </Statistic>
      </Grid>
      <div className="oui-space-y-2">
        <AssetDetail
          label={t("extend.portfolio.volume.ltd")}
          value={props.perpTradingVolume}
          visible={props.visible}
          unit="USDC"
        />
        <AssetDetail
          label={t("extend.portfolio.volume.today")}
          value={props.dailyVolume}
          visible={props.visible}
          unit="USDC"
        />
        <AssetDetail
          label={t("extend.portfolio.profit.30d")}
          value={props.totalProfit}
          visible={props.visible}
          unit="USDC"
        />
        <AssetDetail
          label={t("extend.portfolio.maxdrawdown")}
          value={props.maxDrawdown}
          visible={props.visible}
          unit="USDC"
        />
        <AssetDetail
          label={t("extend.portfolio.total.deposit")}
          value={props.totalDeposit}
          visible={props.visible}
          unit="USDC"
        />
        <AssetDetail
          label={t("extend.portfolio.total.withdraw")}
          value={props.totalWithdrawal}
          visible={props.visible}
          unit="USDC"
        />
      </div>
    </div>
  );
};

interface TooltipContentProps {
  description: ReactNode;
  formula: ReactNode;
}

export const TooltipContent: FC<TooltipContentProps> = (props) => {
  const { description, formula } = props;
  return (
    <div className="oui-min-w-[204px] oui-max-w-[240px] oui-text-2xs oui-leading-normal oui-text-base-contrast-80">
      {typeof description !== "undefined" && description !== null && (
        <span>{description}</span>
      )}
      <Divider className="oui-border-white/10" my={2} />
      {typeof formula !== "undefined" && formula !== null && (
        <span>{formula}</span>
      )}
    </div>
  );
};

interface AssetDetailProps {
  label: string;
  description?: ReactNode;
  formula?: ReactNode;
  visible: boolean;
  value?: number | string;
  unit?: string;
  rule?: "percentages";
  isConnected?: boolean;
  showPercentage?: boolean;
  placeholder?: string;
}

const AssetDetail: FC<AssetDetailProps> = (props) => {
  const {
    label,
    description,
    formula,
    visible,
    value,
    unit,
    rule,
    placeholder,
  } = props;
  return (
    <Flex justify="between">
      <Tooltip
        className={""}
        content={<TooltipContent description={description} formula={formula} />}
      >
        <Text
          size="2xs"
          color="neutral"
          weight="semibold"
          className="oui-cursor-pointer oui-border-b oui-border-dashed oui-border-line-12"
        >
          {label}
        </Text>
      </Tooltip>
      <Text.numeral
        visible={visible}
        size="2xs"
        unit={unit}
        unitClassName="oui-text-base-contrast-36 oui-ml-0.5"
        as="div"
        rule={rule}
        padding={false}
        dp={2}
        // suffix={value && unit}
        placeholder={placeholder}
      >
        {value || "--"}
      </Text.numeral>
    </Flex>
  );
};
