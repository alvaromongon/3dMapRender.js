var SimpleGUI = {
    userConfig: null,
    processToRun: null,
    widthAndHeight: null,
    numberOfSites: null,
    numberOfRivers: null,

    processRunning: false,

    create: function (userConfig, processToRun) {
        if (!userConfig || !processToRun) {
            console.error("SimpleGUI.create method requires a not null userConfig and process to run parameter");
            return;
        }

        this.userConfig = userConfig;        
        this.processToRun = processToRun;

        this.widthAndHeight = this.userConfig.width;
        this.numberOfSites = this.userConfig.nbSites;
        this.numberOfRivers = this.userConfig.nbRivers;

        var gui = new dat.GUI();
        
        gui.add( this, 'widthAndHeight', 256, 1024 ).step( 256 );
        gui.add( this, 'numberOfSites', 1000, 50000 ).step( 100 );
        gui.add( this, 'numberOfRivers', 0, 250 ).step( 5 );
        gui.add(this, 'recalculate');

        gui.open();
    },

    recalculate: function(){
        if (this.processRunning){
            alert("Let me finish the current recalcualtion before starting a new one please.")
        } else {
            this.processRunning = true;

            this.userConfig.width = this.widthAndHeight;
            this.userConfig.height = this.widthAndHeight;
            this.userConfig.nbSites = this.numberOfSites;
            this.userConfig.nbRivers = this.numberOfRivers;
    
            this.processToRun(this.userConfig);

            this.processRunning = false;
        }
    }
}