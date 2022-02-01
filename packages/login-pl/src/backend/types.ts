
import type {BackendControllerSettings} from "@pgweb/utils/node";

export interface BackendSettings extends BackendControllerSettings {
    pwdHashingType: string;
}