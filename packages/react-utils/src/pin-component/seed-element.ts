
import type {
    UniUiStatus,
    UniUiElement,
    UniUiElementEventHandler
} from "pinglue/browser";

import type {
    StatesObject
} from "./seed-states";

//==============================

export class SeedElement implements UniUiElement {

    public statesObject: StatesObject = {};

    // event name -> set of handlers
    private eventHandlers =
    new Map<string, Set<UniUiElementEventHandler>>();

    set status(val: UniUiStatus) {

        this.statesObject.status?.[1](val);

    }

    get status(): UniUiStatus {

        return this.statesObject.status?.[0];

    }

    set value(val: any) {

        this.statesObject.value?.[1](val);

    }
    get value() {

        return this.statesObject.value?.[0];

    }

    set data(value: any) {

        this.statesObject.data?.[1](value);

    }
    get data() {

        return this.statesObject.data?.[0];

    }

    getProp(attName: string): any {

        return this.statesObject.props?.[0][attName];

    }

    getProps(attNames: string[]): Record<string, any> {

        return attNames.reduce(
            (acc, attName) => {

                acc[attName] = this.getProp(attName);
                return acc;

            }, {}
        );

    }

    setProp(attName: string, attVal: any): void {

        if (!this.statesObject.props) return;

        const oldProp = this.statesObject.props[0];

        // TODO: use immutable lib for this
        this.statesObject.props[1]({
            ...oldProp,
            [attName]: attVal
        });

    }

    setProps(object: Record<string, any>): void {

        if (!this.statesObject.props) return;

        const oldProp = this.statesObject.props[0];

        // TODO: use immutable lib for this
        this.statesObject.props[1]({
            ...oldProp,
            ...object
        });

    }

    addEventListener(
        eventName: string,
        handler: UniUiElementEventHandler
    ): void {

        // adding to event handlers
        let set = this.eventHandlers.get(eventName);

        if (!set) {

            set = new Set<UniUiElementEventHandler>();
            this.eventHandlers.set(
                eventName, set
            );

        }
        set.add(handler);

    }

    removeEventListener(
        eventName: string,
        handler: UniUiElementEventHandler
    ): void {

        const set = this.eventHandlers.get(eventName);
        if (set) set.delete(handler);

    }

    public applyEventListeners(node: Element) {

        for(const [eventName, handlers]
            of this.eventHandlers
        ) {

            for (const handler of handlers)
                node.addEventListener(eventName, handler);

        }

    }

}