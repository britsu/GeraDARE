/*
               File: HDREWP02
        Description: Dare Avulso
             Author: GeneXus Java Generator version 10_2_7-90633
       Generated on: March 23, 2026 12:46:26.43
       Program type: Main program
          Main DBMS: oracle7
*/
gx.evt.autoSkip = false;
function hdrewp02() {
   this.ServerClass =  "HDREWP02" ;
   this.PackageName =  "" ;
   this.setObjectType("web");
   this.hasEnterEvent = false;
   this.skipOnEnter = false;
   this.SetStandaloneVars=function()
   {
   };
   this.Validv_Dreinsest=function()
   {
      try {
         var gxballoon = gx.util.balloon.getNew("vDREINSEST");
         this.AnyError  = 0;

      }
      catch(e){}
      try {
         if (gxballoon == null) return true; return gxballoon.show();
      }
      catch(e){}
      return true ;
   }
   this.Validv_Drecdgrct=function()
   {
      try {
         var gxballoon = gx.util.balloon.getNew("vDRECDGRCT");
         this.AnyError  = 0;

      }
      catch(e){}
      try {
         if (gxballoon == null) return true; return gxballoon.show();
      }
      catch(e){}
      return true ;
   }
   this.e13052_client=function()
   {
      this.executeServerEvent("'CALCULAR'", false);
   };
   this.e14052_client=function()
   {
      this.executeServerEvent("VDRECDGRCT.CLICK", true);
   };
   this.e15052_client=function()
   {
      this.executeServerEvent("VVENCIMENTO_ICMS.CLICK", true);
   };
   this.e16052_client=function()
   {
      this.executeServerEvent("VSUBCDGRCT.CLICK", true);
   };
   this.e17052_client=function()
   {
      this.executeServerEvent("'CONFIRM'", false);
   };
   this.e18052_client=function()
   {
      this.executeServerEvent("VANOBASEMULTA.CLICK", true);
   };
   this.e20052_client=function()
   {
      this.executeServerEvent("VUFCDGORI.CLICK", true);
   };
   this.e21052_client=function()
   {
      this.executeServerEvent("VDRETDCORI.CLICK", true);
   };
   this.e22052_client=function()
   {
      this.executeServerEvent("ENTER", true);
   };
   this.e23051_client=function()
   {
      this.executeServerEvent("CANCEL", true);
   };
   this.GXValidFnc = [];
   this.GXCtrlIds=[4,9,12,19,22,24,27,29,32,34,37,39,40,43,45,51,53,56,58,61,63,66,68,74,76,82,84,87,89,91,92,93,95,96,97,100,102,107,109,112,115,117,119,121,122,125,127,129,131,134,136,138,140,143,145,147,149,156,159,161,162,181,182];
   this.GXLastCtrlId =182;
   this.GXValidFnc[4]={fld:"TABLE2",grid:0};
   this.GXValidFnc[9]={fld:"IMAGE1",grid:0};
   this.GXValidFnc[12]={fld:"TEXTBLOCK23", format:0,grid:0};
   this.GXValidFnc[19]={fld:"TABLE1",grid:0};
   this.GXValidFnc[22]={fld:"TEXTBLOCK21", format:0,grid:0};
   this.GXValidFnc[24]={lvl:0,type:"char",len:60,dec:0,sign:false,pic:"@!",ro:1,grid:0,gxgrid:null,fnc:null,isvalid:null,rgrid:[],fld:"vDRERAZSOC",gxz:"ZV29DreRazSoc",gxold:"OV29DreRazSoc",gxvar:"AV29DreRazSoc",ucs:[],op:[],ip:[],nacdep:[],ctrltype:"edit",v2v:function(Value){gx.O.AV29DreRazSoc=Value},v2z:function(Value){gx.O.ZV29DreRazSoc=Value},v2c:function(){gx.fn.setControlValue("vDRERAZSOC",gx.O.AV29DreRazSoc,0)},c2v:function(){gx.O.AV29DreRazSoc=this.val();},val:function(){return gx.fn.getControlValue("vDRERAZSOC")},nac:function(){return  false }};
   this.GXValidFnc[27]={fld:"TEXTBLOCK20", format:0,grid:0};
   this.GXValidFnc[29]={lvl:0,type:"char",len:18,dec:0,sign:false,pic:"@!",ro:0,grid:0,gxgrid:null,fnc:null,isvalid:null,rgrid:[],fld:"vCECPFCNPJ",gxz:"ZV43CECPFCNPJ",gxold:"OV43CECPFCNPJ",gxvar:"AV43CECPFCNPJ",ucs:[],op:[],ip:[],nacdep:[],ctrltype:"edit",v2v:function(Value){gx.O.AV43CECPFCNPJ=Value},v2z:function(Value){gx.O.ZV43CECPFCNPJ=Value},v2c:function(){gx.fn.setControlValue("vCECPFCNPJ",gx.O.AV43CECPFCNPJ,0)},c2v:function(){gx.O.AV43CECPFCNPJ=this.val();},val:function(){return gx.fn.getControlValue("vCECPFCNPJ")},nac:function(){return  false }};
   this.GXValidFnc[32]={fld:"TEXTBLOCK19", format:0,grid:0};
   this.GXValidFnc[34]={lvl:0,type:"char",len:18,dec:0,sign:false,ro:0,grid:0,gxgrid:null,fnc:this.Validv_Dreinsest,isvalid:null,rgrid:[],fld:"vDREINSEST",gxz:"ZV24DreInsEst",gxold:"OV24DreInsEst",gxvar:"AV24DreInsEst",ucs:[],op:[],ip:[],nacdep:[],ctrltype:"edit",v2v:function(Value){gx.O.AV24DreInsEst=Value},v2z:function(Value){gx.O.ZV24DreInsEst=Value},v2c:function(){gx.fn.setControlValue("vDREINSEST",gx.O.AV24DreInsEst,0)},c2v:function(){gx.O.AV24DreInsEst=this.val();},val:function(){return gx.fn.getControlValue("vDREINSEST")},nac:function(){return  false }};
   this.GXValidFnc[37]={fld:"TEXTBLOCK18", format:0,grid:0};
   this.GXValidFnc[39]={lvl:0,type:"char",len:2,dec:0,sign:false,pic:"@!",ro:0,grid:0,gxgrid:null,fnc:null,isvalid:null,rgrid:[],fld:"vUFCDGORI",gxz:"ZV5UFCdgOri",gxold:"OV5UFCdgOri",gxvar:"AV5UFCdgOri",ucs:[],op:[],ip:[],nacdep:[],ctrltype:"dyncombo",v2v:function(Value){gx.O.AV5UFCdgOri=Value},v2z:function(Value){gx.O.ZV5UFCdgOri=Value},v2c:function(){gx.fn.setComboBoxValue("vUFCDGORI",gx.O.AV5UFCdgOri)},c2v:function(){gx.O.AV5UFCdgOri=this.val();},val:function(){return gx.fn.getControlValue("vUFCDGORI")},nac:function(){return  false }};
   this.GXValidFnc[40]={lvl:0,type:"int",len:7,dec:0,sign:false,pic:"ZZZZZZ9",ro:0,grid:0,gxgrid:null,fnc:null,isvalid:null,rgrid:[],fld:"vMUNCDGORI",gxz:"ZV6MunCdgOri",gxold:"OV6MunCdgOri",gxvar:"AV6MunCdgOri",ucs:[],op:[],ip:[],nacdep:[],ctrltype:"combo",v2v:function(Value){gx.O.AV6MunCdgOri=gx.num.intval(Value)},v2z:function(Value){gx.O.ZV6MunCdgOri=gx.num.intval(Value)},v2c:function(){gx.fn.setComboBoxValue("vMUNCDGORI",gx.O.AV6MunCdgOri)},c2v:function(){gx.O.AV6MunCdgOri=this.val();},val:function(){return gx.fn.getIntegerValue("vMUNCDGORI",'.')},nac:function(){return  false }};
   this.GXValidFnc[43]={fld:"TEXTBLOCK17", format:0,grid:0};
   this.GXValidFnc[45]={lvl:0,type:"int",len:7,dec:0,sign:false,pic:"999999-9",ro:0,grid:0,gxgrid:null,fnc:null,isvalid:null,rgrid:[],fld:"vDRECDGMUN",gxz:"ZV10DreCdgMun",gxold:"OV10DreCdgMun",gxvar:"AV10DreCdgMun",ucs:[],op:[],ip:[],nacdep:[],ctrltype:"combo",v2v:function(Value){gx.O.AV10DreCdgMun=gx.num.intval(Value)},v2z:function(Value){gx.O.ZV10DreCdgMun=gx.num.intval(Value)},v2c:function(){gx.fn.setComboBoxValue("vDRECDGMUN",gx.O.AV10DreCdgMun)},c2v:function(){gx.O.AV10DreCdgMun=this.val();},val:function(){return gx.fn.getIntegerValue("vDRECDGMUN",'.')},nac:function(){return  false }};
   this.GXValidFnc[51]={fld:"TEXTBLOCK16", format:0,grid:0};
   this.GXValidFnc[53]={lvl:0,type:"int",len:1,dec:0,sign:false,pic:"9",ro:0,grid:0,gxgrid:null,fnc:null,isvalid:null,rgrid:[],fld:"vDRETDCORI",gxz:"ZV32DreTdcOri",gxold:"OV32DreTdcOri",gxvar:"AV32DreTdcOri",ucs:[],op:[],ip:[],nacdep:[],ctrltype:"combo",v2v:function(Value){gx.O.AV32DreTdcOri=gx.num.intval(Value)},v2z:function(Value){gx.O.ZV32DreTdcOri=gx.num.intval(Value)},v2c:function(){gx.fn.setComboBoxValue("vDRETDCORI",gx.O.AV32DreTdcOri)},c2v:function(){gx.O.AV32DreTdcOri=this.val();},val:function(){return gx.fn.getIntegerValue("vDRETDCORI",'.')},nac:function(){return  false }};
   this.GXValidFnc[56]={fld:"TEXTBLOCK15", format:0,grid:0};
   this.GXValidFnc[58]={lvl:0,type:"char",len:30,dec:0,sign:false,ro:0,grid:0,gxgrid:null,fnc:null,isvalid:null,rgrid:[],fld:"vDREDOCORI",gxz:"ZV15DreDocOri",gxold:"OV15DreDocOri",gxvar:"AV15DreDocOri",ucs:[],op:[],ip:[],nacdep:[],ctrltype:"edit",v2v:function(Value){gx.O.AV15DreDocOri=Value},v2z:function(Value){gx.O.ZV15DreDocOri=Value},v2c:function(){gx.fn.setControlValue("vDREDOCORI",gx.O.AV15DreDocOri,0)},c2v:function(){gx.O.AV15DreDocOri=this.val();},val:function(){return gx.fn.getControlValue("vDREDOCORI")},nac:function(){return  false }};
   this.GXValidFnc[61]={fld:"TEXTBLOCK14", format:0,grid:0};
   this.GXValidFnc[63]={lvl:0,type:"char",len:15,dec:0,sign:false,pic:"@!",ro:0,grid:0,gxgrid:null,fnc:null,isvalid:null,rgrid:[],fld:"vDREDSCDOC",gxz:"ZV16DreDscDoc",gxold:"OV16DreDscDoc",gxvar:"AV16DreDscDoc",ucs:[],op:[],ip:[],nacdep:[],ctrltype:"edit",v2v:function(Value){gx.O.AV16DreDscDoc=Value},v2z:function(Value){gx.O.ZV16DreDscDoc=Value},v2c:function(){gx.fn.setControlValue("vDREDSCDOC",gx.O.AV16DreDscDoc,0)},c2v:function(){gx.O.AV16DreDscDoc=this.val();},val:function(){return gx.fn.getControlValue("vDREDSCDOC")},nac:function(){return  false }};
   this.GXValidFnc[66]={fld:"TEXTBLOCK13", format:0,grid:0};
   this.GXValidFnc[68]={lvl:0,type:"int",len:3,dec:0,sign:false,pic:"ZZ9",ro:0,grid:0,gxgrid:null,fnc:null,isvalid:null,rgrid:[],fld:"vDRENROPAR",gxz:"ZV26DreNroPar",gxold:"OV26DreNroPar",gxvar:"AV26DreNroPar",ucs:[],op:[],ip:[],nacdep:[],ctrltype:"edit",v2v:function(Value){gx.O.AV26DreNroPar=gx.num.intval(Value)},v2z:function(Value){gx.O.ZV26DreNroPar=gx.num.intval(Value)},v2c:function(){gx.fn.setControlValue("vDRENROPAR",gx.O.AV26DreNroPar,0)},c2v:function(){gx.O.AV26DreNroPar=this.val();},val:function(){return gx.fn.getIntegerValue("vDRENROPAR",'.')},nac:function(){return  false }};
   this.GXValidFnc[74]={fld:"TEXTBLOCK12", format:0,grid:0};
   this.GXValidFnc[76]={lvl:0,type:"int",len:7,dec:0,sign:false,pic:"ZZZZZZ9",ro:0,grid:0,gxgrid:null,fnc:this.Validv_Drecdgrct,isvalid:null,rgrid:[],fld:"vDRECDGRCT",gxz:"ZV11DreCdgRct",gxold:"OV11DreCdgRct",gxvar:"AV11DreCdgRct",ucs:[],op:[],ip:[],nacdep:[],ctrltype:"combo",v2v:function(Value){gx.O.AV11DreCdgRct=gx.num.intval(Value)},v2z:function(Value){gx.O.ZV11DreCdgRct=gx.num.intval(Value)},v2c:function(){gx.fn.setComboBoxValue("vDRECDGRCT",gx.O.AV11DreCdgRct)},c2v:function(){gx.O.AV11DreCdgRct=this.val();},val:function(){return gx.fn.getIntegerValue("vDRECDGRCT",'.')},nac:function(){return  false }};
   this.GXValidFnc[82]={fld:"TEXTBLOCK11", format:0,grid:0};
   this.GXValidFnc[84]={lvl:0,type:"char",len:255,dec:0,sign:false,pic:"@!",ro:0,grid:0,gxgrid:null,fnc:null,isvalid:null,rgrid:[],fld:"vSUBCDGRCT",gxz:"ZV69subCdgRct",gxold:"OV69subCdgRct",gxvar:"AV69subCdgRct",ucs:[],op:[],ip:[],nacdep:[],ctrltype:"combo",v2v:function(Value){gx.O.AV69subCdgRct=Value},v2z:function(Value){gx.O.ZV69subCdgRct=Value},v2c:function(){gx.fn.setComboBoxValue("vSUBCDGRCT",gx.O.AV69subCdgRct)},c2v:function(){gx.O.AV69subCdgRct=this.val();},val:function(){return gx.fn.getControlValue("vSUBCDGRCT")},nac:function(){return  false }};
   this.GXValidFnc[87]={fld:"TEXTBLOCK10", format:0,grid:0};
   this.GXValidFnc[89]={lvl:0,type:"decimal",len:9,dec:2,sign:false,pic:"ZZZZZ9.99",ro:0,grid:0,gxgrid:null,fnc:null,isvalid:null,rgrid:[],fld:"vDREQTDALI",gxz:"ZV27DreQtdAli",gxold:"OV27DreQtdAli",gxvar:"AV27DreQtdAli",ucs:[],op:[],ip:[],nacdep:[],ctrltype:"edit",v2v:function(Value){gx.O.AV27DreQtdAli=gx.fn.toDecimalValue(Value,',','.')},v2z:function(Value){gx.O.ZV27DreQtdAli=gx.fn.toDecimalValue(Value,'.',',')},v2c:function(){gx.fn.setDecimalValue("vDREQTDALI",gx.O.AV27DreQtdAli,2,',')},c2v:function(){gx.O.AV27DreQtdAli=this.val();},val:function(){return gx.fn.getDecimalValue("vDREQTDALI",'.',',')},nac:function(){return  false }};
   this.GXValidFnc[91]={fld:"TXTANOBASE", format:0,grid:0};
   this.GXValidFnc[92]={fld:"TXTICMSVENC", format:0,grid:0};
   this.GXValidFnc[93]={fld:"TXTQTDGADO", format:0,grid:0};
   this.GXValidFnc[95]={lvl:0,type:"decimal",len:9,dec:2,sign:false,pic:"ZZZZZ9.99",ro:0,grid:0,gxgrid:null,fnc:null,isvalid:null,rgrid:[],fld:"vDREQTDGAD",gxz:"ZV92DreQtdGad",gxold:"OV92DreQtdGad",gxvar:"AV92DreQtdGad",ucs:[],op:[],ip:[],nacdep:[],ctrltype:"edit",v2v:function(Value){gx.O.AV92DreQtdGad=gx.fn.toDecimalValue(Value,',','.')},v2z:function(Value){gx.O.ZV92DreQtdGad=gx.fn.toDecimalValue(Value,'.',',')},v2c:function(){gx.fn.setDecimalValue("vDREQTDGAD",gx.O.AV92DreQtdGad,2,',')},c2v:function(){gx.O.AV92DreQtdGad=this.val();},val:function(){return gx.fn.getDecimalValue("vDREQTDGAD",'.',',')},nac:function(){return  false }};
   this.GXValidFnc[96]={lvl:0,type:"int",len:4,dec:0,sign:false,pic:"ZZZ9",ro:0,grid:0,gxgrid:null,fnc:null,isvalid:null,rgrid:[],fld:"vANOBASEMULTA",gxz:"ZV95anoBaseMulta",gxold:"OV95anoBaseMulta",gxvar:"AV95anoBaseMulta",ucs:[],op:[],ip:[],nacdep:[],ctrltype:"combo",v2v:function(Value){gx.O.AV95anoBaseMulta=gx.num.intval(Value)},v2z:function(Value){gx.O.ZV95anoBaseMulta=gx.num.intval(Value)},v2c:function(){gx.fn.setComboBoxValue("vANOBASEMULTA",gx.O.AV95anoBaseMulta)},c2v:function(){gx.O.AV95anoBaseMulta=this.val();},val:function(){return gx.fn.getIntegerValue("vANOBASEMULTA",'.')},nac:function(){return  false }};
   this.GXValidFnc[97]={lvl:0,type:"int",len:1,dec:0,sign:false,pic:"9",ro:0,grid:0,gxgrid:null,fnc:null,isvalid:null,rgrid:[],fld:"vVENCIMENTO_ICMS",gxz:"ZV118Vencimento_ICMS",gxold:"OV118Vencimento_ICMS",gxvar:"AV118Vencimento_ICMS",ucs:[],op:[],ip:[],nacdep:[],ctrltype:"combo",v2v:function(Value){gx.O.AV118Vencimento_ICMS=gx.num.intval(Value)},v2z:function(Value){gx.O.ZV118Vencimento_ICMS=gx.num.intval(Value)},v2c:function(){gx.fn.setComboBoxValue("vVENCIMENTO_ICMS",gx.O.AV118Vencimento_ICMS)},c2v:function(){gx.O.AV118Vencimento_ICMS=this.val();},val:function(){return gx.fn.getIntegerValue("vVENCIMENTO_ICMS",'.')},nac:function(){return  false }};
   this.GXValidFnc[100]={fld:"TXTNFACHV", format:0,grid:0};
   this.GXValidFnc[102]={lvl:0,type:"svchar",len:44,dec:0,sign:false,ro:0,grid:0,gxgrid:null,fnc:null,isvalid:null,rgrid:[],fld:"vDRENFECHV",gxz:"ZV132DreNfeChv",gxold:"OV132DreNfeChv",gxvar:"AV132DreNfeChv",ucs:[],op:[],ip:[],nacdep:[],ctrltype:"edit",v2v:function(Value){gx.O.AV132DreNfeChv=Value},v2z:function(Value){gx.O.ZV132DreNfeChv=Value},v2c:function(){gx.fn.setControlValue("vDRENFECHV",gx.O.AV132DreNfeChv,0)},c2v:function(){gx.O.AV132DreNfeChv=this.val();},val:function(){return gx.fn.getControlValue("vDRENFECHV")},nac:function(){return  false }};
   this.GXValidFnc[107]={fld:"TXTQTDHECTARE", format:0,grid:0};
   this.GXValidFnc[109]={lvl:0,type:"decimal",len:9,dec:2,sign:false,pic:"ZZZZZ9.99",ro:0,grid:0,gxgrid:null,fnc:null,isvalid:null,rgrid:[],fld:"vDREQTDHEC",gxz:"ZV134DreQtdHec",gxold:"OV134DreQtdHec",gxvar:"AV134DreQtdHec",ucs:[],op:[],ip:[],nacdep:[],ctrltype:"edit",v2v:function(Value){gx.O.AV134DreQtdHec=gx.fn.toDecimalValue(Value,',','.')},v2z:function(Value){gx.O.ZV134DreQtdHec=gx.fn.toDecimalValue(Value,'.',',')},v2c:function(){gx.fn.setDecimalValue("vDREQTDHEC",gx.O.AV134DreQtdHec,2,',')},c2v:function(){gx.O.AV134DreQtdHec=this.val();},val:function(){return gx.fn.getDecimalValue("vDREQTDHEC",'.',',')},nac:function(){return  false }};
   this.GXValidFnc[112]={fld:"TABLE4",grid:0};
   this.GXValidFnc[115]={fld:"TEXTBLOCK1", format:0,grid:0};
   this.GXValidFnc[117]={lvl:0,type:"date",len:10,dec:0,sign:false,ro:0,grid:0,gxgrid:null,fnc:null,isvalid:null,rgrid:[],fld:"vDREDTAVEN",gxz:"ZV20DreDtaVen",gxold:"OV20DreDtaVen",gxvar:"AV20DreDtaVen",dp:{f:0,st:false,wn:false,mf:false,pic:"99/99/9999",dec:0},ucs:[],op:[],ip:[],nacdep:[],ctrltype:"edit",v2v:function(Value){gx.O.AV20DreDtaVen=gx.fn.toDatetimeValue(Value)},v2z:function(Value){gx.O.ZV20DreDtaVen=gx.fn.toDatetimeValue(Value)},v2c:function(){gx.fn.setControlValue("vDREDTAVEN",gx.O.AV20DreDtaVen,0)},c2v:function(){gx.O.AV20DreDtaVen=this.val();},val:function(){return gx.fn.getControlValue("vDREDTAVEN")},nac:function(){return  false }};
   this.GXValidFnc[119]={fld:"TEXTBLOCK5", format:0,grid:0};
   this.GXValidFnc[121]={lvl:0,type:"char",len:7,dec:0,sign:false,pic:"99/9999",ro:0,grid:0,gxgrid:null,fnc:null,isvalid:null,rgrid:[],fld:"vDREREFCHAR",gxz:"ZV84DreRefChar",gxold:"OV84DreRefChar",gxvar:"AV84DreRefChar",ucs:[],op:[],ip:[],nacdep:[],ctrltype:"edit",v2v:function(Value){gx.O.AV84DreRefChar=Value},v2z:function(Value){gx.O.ZV84DreRefChar=Value},v2c:function(){gx.fn.setControlValue("vDREREFCHAR",gx.O.AV84DreRefChar,0)},c2v:function(){gx.O.AV84DreRefChar=this.val();},val:function(){return gx.fn.getControlValue("vDREREFCHAR")},nac:function(){return  false }};
   this.GXValidFnc[122]={fld:"TEXTBLOCK22", format:0,grid:0};
   this.GXValidFnc[125]={fld:"TEXTBLOCK2", format:0,grid:0};
   this.GXValidFnc[127]={lvl:0,type:"decimal",len:15,dec:2,sign:false,pic:"ZZZ,ZZZ,ZZZ,ZZ9.99",ro:0,grid:0,gxgrid:null,fnc:null,isvalid:null,rgrid:[],fld:"vDREVLRPRI",gxz:"ZV39DreVlrPri",gxold:"OV39DreVlrPri",gxvar:"AV39DreVlrPri",ucs:[],op:[],ip:[],nacdep:[],ctrltype:"edit",v2v:function(Value){gx.O.AV39DreVlrPri=gx.fn.toDecimalValue(Value,',','.')},v2z:function(Value){gx.O.ZV39DreVlrPri=gx.fn.toDecimalValue(Value,'.',',')},v2c:function(){gx.fn.setDecimalValue("vDREVLRPRI",gx.O.AV39DreVlrPri,2,',')},c2v:function(){gx.O.AV39DreVlrPri=this.val();},val:function(){return gx.fn.getDecimalValue("vDREVLRPRI",'.',',')},nac:function(){return  false }};
   this.GXValidFnc[129]={fld:"TEXTBLOCK6", format:0,grid:0};
   this.GXValidFnc[131]={lvl:0,type:"decimal",len:15,dec:2,sign:false,pic:"ZZZ,ZZZ,ZZZ,ZZ9.99",ro:0,grid:0,gxgrid:null,fnc:null,isvalid:null,rgrid:[],fld:"vDREVLRMLT",gxz:"ZV38DreVlrMlt",gxold:"OV38DreVlrMlt",gxvar:"AV38DreVlrMlt",ucs:[],op:[],ip:[],nacdep:[],ctrltype:"edit",v2v:function(Value){gx.O.AV38DreVlrMlt=gx.fn.toDecimalValue(Value,',','.')},v2z:function(Value){gx.O.ZV38DreVlrMlt=gx.fn.toDecimalValue(Value,'.',',')},v2c:function(){gx.fn.setDecimalValue("vDREVLRMLT",gx.O.AV38DreVlrMlt,2,',')},c2v:function(){gx.O.AV38DreVlrMlt=this.val();},val:function(){return gx.fn.getDecimalValue("vDREVLRMLT",'.',',')},nac:function(){return  false }};
   this.GXValidFnc[134]={fld:"TEXTBLOCK3", format:0,grid:0};
   this.GXValidFnc[136]={lvl:0,type:"decimal",len:15,dec:2,sign:false,pic:"ZZZ,ZZZ,ZZZ,ZZ9.99",ro:0,grid:0,gxgrid:null,fnc:null,isvalid:null,rgrid:[],fld:"vDREVLRJUR",gxz:"ZV37DreVlrJur",gxold:"OV37DreVlrJur",gxvar:"AV37DreVlrJur",ucs:[],op:[],ip:[],nacdep:[],ctrltype:"edit",v2v:function(Value){gx.O.AV37DreVlrJur=gx.fn.toDecimalValue(Value,',','.')},v2z:function(Value){gx.O.ZV37DreVlrJur=gx.fn.toDecimalValue(Value,'.',',')},v2c:function(){gx.fn.setDecimalValue("vDREVLRJUR",gx.O.AV37DreVlrJur,2,',')},c2v:function(){gx.O.AV37DreVlrJur=this.val();},val:function(){return gx.fn.getDecimalValue("vDREVLRJUR",'.',',')},nac:function(){return  false }};
   this.GXValidFnc[138]={fld:"TEXTBLOCK7", format:0,grid:0};
   this.GXValidFnc[140]={lvl:0,type:"decimal",len:15,dec:2,sign:false,pic:"ZZZ,ZZZ,ZZZ,ZZ9.99",ro:0,grid:0,gxgrid:null,fnc:null,isvalid:null,rgrid:[],fld:"vDREVLRATM",gxz:"ZV36DreVlrAtm",gxold:"OV36DreVlrAtm",gxvar:"AV36DreVlrAtm",ucs:[],op:[],ip:[],nacdep:[],ctrltype:"edit",v2v:function(Value){gx.O.AV36DreVlrAtm=gx.fn.toDecimalValue(Value,',','.')},v2z:function(Value){gx.O.ZV36DreVlrAtm=gx.fn.toDecimalValue(Value,'.',',')},v2c:function(){gx.fn.setDecimalValue("vDREVLRATM",gx.O.AV36DreVlrAtm,2,',')},c2v:function(){gx.O.AV36DreVlrAtm=this.val();},val:function(){return gx.fn.getDecimalValue("vDREVLRATM",'.',',')},nac:function(){return  false }};
   this.GXValidFnc[143]={fld:"TEXTBLOCK4", format:0,grid:0};
   this.GXValidFnc[145]={lvl:0,type:"decimal",len:15,dec:2,sign:false,pic:"ZZZ,ZZZ,ZZZ,ZZ9.99",ro:0,grid:0,gxgrid:null,fnc:null,isvalid:null,rgrid:[],fld:"vDREVLRTSE",gxz:"ZV40DreVlrTse",gxold:"OV40DreVlrTse",gxvar:"AV40DreVlrTse",ucs:[],op:[],ip:[],nacdep:[],ctrltype:"edit",v2v:function(Value){gx.O.AV40DreVlrTse=gx.fn.toDecimalValue(Value,',','.')},v2z:function(Value){gx.O.ZV40DreVlrTse=gx.fn.toDecimalValue(Value,'.',',')},v2c:function(){gx.fn.setDecimalValue("vDREVLRTSE",gx.O.AV40DreVlrTse,2,',')},c2v:function(){gx.O.AV40DreVlrTse=this.val();},val:function(){return gx.fn.getDecimalValue("vDREVLRTSE",'.',',')},nac:function(){return  false }};
   this.GXValidFnc[147]={fld:"TEXTBLOCK8", format:0,grid:0};
   this.GXValidFnc[149]={lvl:0,type:"decimal",len:15,dec:2,sign:false,pic:"ZZZ,ZZZ,ZZZ,ZZ9.99",ro:0,grid:0,gxgrid:null,fnc:null,isvalid:null,rgrid:[],fld:"vDREVLRTOT",gxz:"ZV8DreVlrTot",gxold:"OV8DreVlrTot",gxvar:"AV8DreVlrTot",ucs:[],op:[],ip:[],nacdep:[],ctrltype:"edit",v2v:function(Value){gx.O.AV8DreVlrTot=gx.fn.toDecimalValue(Value,',','.')},v2z:function(Value){gx.O.ZV8DreVlrTot=gx.fn.toDecimalValue(Value,'.',',')},v2c:function(){gx.fn.setDecimalValue("vDREVLRTOT",gx.O.AV8DreVlrTot,2,',')},c2v:function(){gx.O.AV8DreVlrTot=this.val();},val:function(){return gx.fn.getDecimalValue("vDREVLRTOT",'.',',')},nac:function(){return  false }};
   this.GXValidFnc[156]={fld:"TABLE6",grid:0};
   this.GXValidFnc[159]={fld:"TEXTBLOCK9", format:0,grid:0};
   this.GXValidFnc[161]={lvl:0,type:"vchar",len:400,dec:0,sign:false,ro:0,multiline:true,grid:0,gxgrid:null,fnc:null,isvalid:null,rgrid:[],fld:"vDREINFCOM",gxz:"ZV23DreInfCom",gxold:"OV23DreInfCom",gxvar:"AV23DreInfCom",ucs:[],op:[],ip:[],nacdep:[],ctrltype:"edit",v2v:function(Value){gx.O.AV23DreInfCom=Value},v2z:function(Value){gx.O.ZV23DreInfCom=Value},v2c:function(){gx.fn.setControlValue("vDREINFCOM",gx.O.AV23DreInfCom,0)},c2v:function(){gx.O.AV23DreInfCom=this.val();},val:function(){return gx.fn.getControlValue("vDREINFCOM")},nac:function(){return  false }};
   this.GXValidFnc[162]={fld:"TABLE5",grid:0};
   this.GXValidFnc[181]={lvl:0,type:"int",len:12,dec:0,sign:false,pic:"999999999999",ro:1,grid:0,gxgrid:null,fnc:null,isvalid:null,rgrid:[],fld:"vDRENOSNUM",gxz:"ZV25DreNosNum",gxold:"OV25DreNosNum",gxvar:"AV25DreNosNum",ucs:[],op:[],ip:[],nacdep:[],ctrltype:"edit",v2v:function(Value){gx.O.AV25DreNosNum=gx.num.intval(Value)},v2z:function(Value){gx.O.ZV25DreNosNum=gx.num.intval(Value)},v2c:function(){gx.fn.setControlValue("vDRENOSNUM",gx.O.AV25DreNosNum,0)},c2v:function(){gx.O.AV25DreNosNum=this.val();},val:function(){return gx.fn.getIntegerValue("vDRENOSNUM",'.')},nac:function(){return  false }};
   this.GXValidFnc[182]={lvl:0,type:"decimal",len:8,dec:2,sign:false,pic:"ZZZZ9.99",ro:0,grid:0,gxgrid:null,fnc:null,isvalid:null,rgrid:[],fld:"vRECACR",gxz:"ZV91RecAcr",gxold:"OV91RecAcr",gxvar:"AV91RecAcr",ucs:[],op:[],ip:[],nacdep:[],ctrltype:"edit",v2v:function(Value){gx.O.AV91RecAcr=gx.fn.toDecimalValue(Value,',','.')},v2z:function(Value){gx.O.ZV91RecAcr=gx.fn.toDecimalValue(Value,'.',',')},v2c:function(){gx.fn.setDecimalValue("vRECACR",gx.O.AV91RecAcr,2,',')},c2v:function(){gx.O.AV91RecAcr=this.val();},val:function(){return gx.fn.getDecimalValue("vRECACR",'.',',')},nac:function(){return  false }};
   this.AV29DreRazSoc = "" ;
   this.ZV29DreRazSoc = "" ;
   this.OV29DreRazSoc = "" ;
   this.AV43CECPFCNPJ = "" ;
   this.ZV43CECPFCNPJ = "" ;
   this.OV43CECPFCNPJ = "" ;
   this.AV24DreInsEst = "" ;
   this.ZV24DreInsEst = "" ;
   this.OV24DreInsEst = "" ;
   this.AV5UFCdgOri = "" ;
   this.ZV5UFCdgOri = "" ;
   this.OV5UFCdgOri = "" ;
   this.AV6MunCdgOri = 0 ;
   this.ZV6MunCdgOri = 0 ;
   this.OV6MunCdgOri = 0 ;
   this.AV10DreCdgMun = 0 ;
   this.ZV10DreCdgMun = 0 ;
   this.OV10DreCdgMun = 0 ;
   this.AV32DreTdcOri = 0 ;
   this.ZV32DreTdcOri = 0 ;
   this.OV32DreTdcOri = 0 ;
   this.AV15DreDocOri = "" ;
   this.ZV15DreDocOri = "" ;
   this.OV15DreDocOri = "" ;
   this.AV16DreDscDoc = "" ;
   this.ZV16DreDscDoc = "" ;
   this.OV16DreDscDoc = "" ;
   this.AV26DreNroPar = 0 ;
   this.ZV26DreNroPar = 0 ;
   this.OV26DreNroPar = 0 ;
   this.AV11DreCdgRct = 0 ;
   this.ZV11DreCdgRct = 0 ;
   this.OV11DreCdgRct = 0 ;
   this.AV69subCdgRct = "" ;
   this.ZV69subCdgRct = "" ;
   this.OV69subCdgRct = "" ;
   this.AV27DreQtdAli = 0 ;
   this.ZV27DreQtdAli = 0 ;
   this.OV27DreQtdAli = 0 ;
   this.AV92DreQtdGad = 0 ;
   this.ZV92DreQtdGad = 0 ;
   this.OV92DreQtdGad = 0 ;
   this.AV95anoBaseMulta = 0 ;
   this.ZV95anoBaseMulta = 0 ;
   this.OV95anoBaseMulta = 0 ;
   this.AV118Vencimento_ICMS = 0 ;
   this.ZV118Vencimento_ICMS = 0 ;
   this.OV118Vencimento_ICMS = 0 ;
   this.AV132DreNfeChv = "" ;
   this.ZV132DreNfeChv = "" ;
   this.OV132DreNfeChv = "" ;
   this.AV134DreQtdHec = 0 ;
   this.ZV134DreQtdHec = 0 ;
   this.OV134DreQtdHec = 0 ;
   this.AV20DreDtaVen = gx.date.nullDate() ;
   this.ZV20DreDtaVen = gx.date.nullDate() ;
   this.OV20DreDtaVen = gx.date.nullDate() ;
   this.AV84DreRefChar = "" ;
   this.ZV84DreRefChar = "" ;
   this.OV84DreRefChar = "" ;
   this.AV39DreVlrPri = 0 ;
   this.ZV39DreVlrPri = 0 ;
   this.OV39DreVlrPri = 0 ;
   this.AV38DreVlrMlt = 0 ;
   this.ZV38DreVlrMlt = 0 ;
   this.OV38DreVlrMlt = 0 ;
   this.AV37DreVlrJur = 0 ;
   this.ZV37DreVlrJur = 0 ;
   this.OV37DreVlrJur = 0 ;
   this.AV36DreVlrAtm = 0 ;
   this.ZV36DreVlrAtm = 0 ;
   this.OV36DreVlrAtm = 0 ;
   this.AV40DreVlrTse = 0 ;
   this.ZV40DreVlrTse = 0 ;
   this.OV40DreVlrTse = 0 ;
   this.AV8DreVlrTot = 0 ;
   this.ZV8DreVlrTot = 0 ;
   this.OV8DreVlrTot = 0 ;
   this.AV23DreInfCom = "" ;
   this.ZV23DreInfCom = "" ;
   this.OV23DreInfCom = "" ;
   this.AV25DreNosNum = 0 ;
   this.ZV25DreNosNum = 0 ;
   this.OV25DreNosNum = 0 ;
   this.AV91RecAcr = 0 ;
   this.ZV91RecAcr = 0 ;
   this.OV91RecAcr = 0 ;
   this.A163AtvCodCo1N = "" ;
   this.A99ConInsEst = "" ;
   this.A94RecAli = "" ;
   this.A89RctCdg = 0 ;
   this.A93RecLim = 0 ;
   this.A92RecAvl = 0 ;
   this.A318TAREspecie = "" ;
   this.A348TAROCod = 0 ;
   this.A317TARInsEst = "" ;
   this.A353TARODR130 = 0 ;
   this.A351TAROVgT = "" ;
   this.A352TAROVgF = gx.date.nullDate() ;
   this.A346TAROSeq = 0 ;
   this.A101TARNum = 0 ;
   this.A102TARODta = 0 ;
   this.A321TARSit = "" ;
   this.A8DreDocOri = "" ;
   this.A33DreQuit = "" ;
   this.A9DreCdgRct = 0 ;
   this.A42RctFlg = "" ;
   this.A43RctAtv = "" ;
   this.A303RctDsc = "" ;
   this.ServerEvents = ["e13052_client" ,"e14052_client" ,"e15052_client" ,"e16052_client" ,"e17052_client" ,"e18052_client" ,"e20052_client" ,"e21052_client" ,"e22052_client" ,"e23051_client"];
   this.SetStandaloneVars( );
}
hdrewp02.prototype = new gx.GxObject;
gx.setParentObj(new hdrewp02());
