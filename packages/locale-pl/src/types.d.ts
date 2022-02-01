
interface Settings extends ControllerSettings {
    defaultLang: string;
    defaultDomain: string;
    globalObjField: string;
}

type LocChanParams = {
    functionName: string;
    key: string | number;
    params?: GenericObject;
};

type LkKeyLocalParams = {
    domain: string; code: string; lang: string;
};
