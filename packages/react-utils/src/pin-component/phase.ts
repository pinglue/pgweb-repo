
export enum PHASE {

    // indewling cts are not yet created, waiting for the pg reg object to become available
    genesis,

    // the init method of dweling cts is being called (bot finished yet) and the uniui element has been created and passed to the cts - but events are not processed
    initing,

    // the start method of dweling cts has been called/calling - events will be processed now
    started,

    // some error happened, no more action will take place
    error
}
