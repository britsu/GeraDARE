/*
               File: HNETCCWKDAPg
        Description: Forma de Pagamento
             Author: GeneXus Java Generator version 10_2_7-90633
       Generated on: March 23, 2026 12:46:28.25
       Program type: Callable routine
          Main DBMS: oracle7
*/
gx.evt.autoSkip = false;
function hnetccwkdapg() {
   this.ServerClass =  "HNETCCWKDAPg" ;
   this.PackageName =  "" ;
   this.setObjectType("web");
   this.hasEnterEvent = false;
   this.skipOnEnter = false;
   this.SetStandaloneVars=function()
   {
      this.AV87Txt=gx.fn.getControlValue("vTXT") ;
   };
   this.e160j2_client=function()
   {
      this.clearMessages();
      this.AV87Txt = "novo teste de cpcola" ;
      this.refreshOutputs([{av:"AV87Txt",fld:"vTXT"}]);
   };
   this.e120j2_client=function()
   {
      this.executeServerEvent("IMGCPPIX.CLICK", true);
   };
   this.e130j2_client=function()
   {
      this.executeServerEvent("IMGIMPDARE.CLICK", true);
   };
   this.e140j2_client=function()
   {
      this.executeServerEvent("IMGPGCRT.CLICK", true);
   };
   this.e170j2_client=function()
   {
      this.executeServerEvent("ENTER", true);
   };
   this.e180j2_client=function()
   {
      this.executeServerEvent("CANCEL", true);
   };
   this.GXValidFnc = [];
   this.GXCtrlIds=[4,8,11,14,17,23,26,27,29,30,32,34,35];
   this.GXLastCtrlId =35;
   this.GXValidFnc[4]={fld:"TABLE1",grid:0};
   this.GXValidFnc[8]={fld:"TABLE2",grid:0};
   this.GXValidFnc[11]={fld:"IMAGE1",grid:0};
   this.GXValidFnc[14]={fld:"TEXTBLOCK1", format:0,grid:0};
   this.GXValidFnc[17]={fld:"INFORMATIVO", format:1,grid:0};
   this.GXValidFnc[23]={fld:"TABLE3",grid:0};
   this.GXValidFnc[26]={fld:"IMGCPPIX",grid:0};
   this.GXValidFnc[27]={fld:"TXBLDARE2", format:0,grid:0};
   this.GXValidFnc[29]={fld:"IMGIMPDARE",grid:0};
   this.GXValidFnc[30]={fld:"TXBLDARE3", format:0,grid:0};
   this.GXValidFnc[32]={fld:"IMGPGCRT",grid:0};
   this.GXValidFnc[34]={fld:"TXBLDARE5", format:0,grid:0};
   this.GXValidFnc[35]={fld:"TXBLDARE4", format:0,grid:0};
   this.A89RctCdg = 0 ;
   this.A45DRcCdg = 0 ;
   this.A47DRcCIO = 0 ;
   this.A303RctDsc = "" ;
   this.A1DreNosNum = 0 ;
   this.A2DreInsEst = "" ;
   this.A4DreCpfCnp = "" ;
   this.A6DreDtaVen = gx.date.nullDate() ;
   this.A5DreRef = 0 ;
   this.A26DreDtaIns = gx.date.nullDate() ;
   this.A9DreCdgRct = 0 ;
   this.A31DreRecAli = "" ;
   this.A38DreNfeChv = "" ;
   this.A32DreQtdAli = 0 ;
   this.A21DreCdgBar = "" ;
   this.A3DreRazSoc = "" ;
   this.A16DreVlrTse = 0 ;
   this.A12DreVlrPri = 0 ;
   this.A13DreVlrMlt = 0 ;
   this.A14DreVlrJur = 0 ;
   this.A15DreVlrAtm = 0 ;
   this.A17DreVlrTot = 0 ;
   this.AV87Txt = "" ;
   this.ServerEvents = ["e120j2_client" ,"e130j2_client" ,"e140j2_client" ,"e170j2_client" ,"e180j2_client"];
   this.VarControlMap["A15DreVlrAtm"] = {id:"DREVLRATM",grid:0,type:"decimal"};
   this.VarControlMap["A14DreVlrJur"] = {id:"DREVLRJUR",grid:0,type:"decimal"};
   this.VarControlMap["A13DreVlrMlt"] = {id:"DREVLRMLT",grid:0,type:"decimal"};
   this.VarControlMap["A12DreVlrPri"] = {id:"DREVLRPRI",grid:0,type:"decimal"};
   this.VarControlMap["A16DreVlrTse"] = {id:"DREVLRTSE",grid:0,type:"decimal"};
   this.VarControlMap["A17DreVlrTot"] = {id:"DREVLRTOT",grid:0,type:"decimal"};
   this.VarControlMap["AV87Txt"] = {id:"vTXT",grid:0,type:"char"};
   this.SetStandaloneVars( );
}
hnetccwkdapg.prototype = new gx.GxObject;
gx.setParentObj(new hnetccwkdapg());
