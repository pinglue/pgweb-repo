
Usage
-------------------------

```jsx

// arg is either the modal id or the full object {id, modalActionOptions}

<Pin roles={{
    "dialog-pl/modal": "modal1"
}}>

    <YourFavoriteModalComponent>
        <Stuff> lablab </Stuff>
    </YourFavoriteModalComponent>

</Pin>

<Pin roles={{
    "dialog-pl/open-modal": {id:"modal1", options:{}}
}}>
    <button> Open modal </button>
</Pin>

<Pin roles={{
    "dialog-pl/close-modal": "modal1"
}}>
    <button> Close modal </button>
</Pin>


```

### Regarding the `YourFavoriteModalComponent`:

This can be any component, adhering to the following conventions:

- prop open (boolean) -> used to open/close the modal component 
- options (instance of ModalActionOptions) -> used to control options for open/close actions, chief among them is the parameter options.zIndex which is used by the dialog plugin to control the modal stack order.
