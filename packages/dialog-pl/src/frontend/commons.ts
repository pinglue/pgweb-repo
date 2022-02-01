
// to be the "options" prop on the seed element
export interface ModalOptions {
    zIndex?: number;
    noAnimation?: boolean;

    // defaults to normal
    status?: "blur" | "overlay" | "normal";

    // the underneath modal status
    prevStatus?: "close" | "open" | "blur" | "overlay";
}

export interface ModalOpenOptions extends ModalOptions {}

export interface ModalCloseOptions extends ModalOptions {}