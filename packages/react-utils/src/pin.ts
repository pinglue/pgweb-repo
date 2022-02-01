
import type {
    ControllerSettings,
    ChannelHandler,
    ChannelRunOptions,
    UniUiStatus
} from "pinglue/browser";

import type {
    PgModuleMessenger
} from "@pinglue/utils";

import React from "react";

//=====================================

export type UseGlueFunction = (
    channelName: string,
    handler: ChannelHandler
) => void;

export interface PinObject {

    // hub status
    isReady: boolean;

    // messaging
    log: PgModuleMessenger;
    report: PgModuleMessenger;

    // channel operations

    runS: (
        channelName: string,
        params?: Object,
        value?: any,
        options?: ChannelRunOptions
    ) => any;

    runA: (
        channelName: string,
        params?: Object,
        value?: any,
        options?: ChannelRunOptions
    ) => Promise<any>;

    useGlue: UseGlueFunction;
}

export type PinProps = {
    id?: string;
    roles?: Object;
    children: React.ReactNode | React.ReactNode[];
};

export type RolesImportInfo = {

    // es module imported from the roles routes
    module: Object;

    // settings of the associated package
    settings?: ControllerSettings;
};
