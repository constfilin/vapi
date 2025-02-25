import util                     from 'node:util';

import * as GoogleSpreadsheet   from 'google-spreadsheet';
import nodemailer               from 'nodemailer';

import dayjs                    from './day-timezone';
import * as misc                from './misc';
import * as Config              from './Config';
import * as Contacts            from './Contacts';

export let server = {} as Server;

export default class Server {

    module_log_level        : Record<string,number> = {};
    config                  : Config.Config;
    contacts_sheet          : (GoogleSpreadsheet.GoogleSpreadsheetWorksheet|undefined);
    nm_transport            : (nodemailer.Transporter|undefined);

    constructor() {
        this.config         = Config.get();
        this.contacts_sheet = undefined; // Let's do it at the very first request
        this.nm_transport   = nodemailer.createTransport(this.config.nm);
        server = this;
        return this;
    }
    log_prefix( level:number ) {
        return `${dayjs().format("YYYY-MM-DD HH:mm:ss")}:${level}`;
    }
    log( level:number, ...args:any[] ) {
        if( this.config.web.loglevel >= level ) {
            // tslint:disable:no-console
            console.log(`${this.log_prefix(level)}: ` + util.format(...args));
        }
        return this;
    }
    module_log( filename:string, level:number, ...args:any[] ) {
        const modname  = (filename.startsWith(this.config.web.path) ? filename.substring(this.config.web.path.length) : filename).replace(/^.*\/([^/\.]+)\.[^\.]+$/,"$1");
        const loglevel = (modname in this.module_log_level) ? this.module_log_level[modname] : this.config.web.loglevel;
        if( loglevel>=level ) {
            // tslint:disable:no-console
            console.log(`${this.log_prefix(level)}: ` + util.format(modname,...args));
        }
        return this;
    }    
    sendEmail(args:{ to:string, subject:string, text:string }) : Promise<void> {
        if( !this.nm_transport )
            throw Error(`Transport is not initialized`);
        return this.nm_transport.sendMail({
            from    : this.config.nm.from,
            to      : args.to,
            subject : args.subject,
            text    : args.text
        });
    }
    async getContacts() : Promise<Contacts.Contact[]> {
        if( !this.contacts_sheet ) {
            this.contacts_sheet = await Contacts.getSheet(this.config.googleApiKey,this.config.spreadsheetId,this.config.worksheetName);
            if( !this.contacts_sheet )
                throw Error(`Cannot find sheet '${this.config.worksheetName}' in ${this.config.spreadsheetId}`);
        }
        return this.contacts_sheet.getRows().then( rows => {
            return Contacts.getFromRows(rows);
        });
    }
    async dispatchCall( name:string ) : Promise<string> {
        const canonicalName = misc.canonicalizePersonName(name);
        const contact = (await this.getContacts()).find( c => {
            // Note: column names are case sensitive
            return c.name===canonicalName;
        });
        if( !contact )
            return `Cannot find name '${name}' in ${this.config.worksheetName}`;
        const djs  = dayjs().tz(contact.timeZone||'America/Los_Angeles');
        if( [0,6].includes(djs.day()) )
            return `say "I am sending email to ${name}, call sendEmail with ${contact.emailAddresses[0]}, say "Thank you for calling Intempus Realty" and hang up.`;
        const hour = djs.hour();
        if( (hour<contact.businessStartHour) || (hour>=contact.businessEndHour) )
            return `say "I am sending email to ${name}, call sendEmail with ${contact.emailAddresses[0]}, say "Thank you for calling Intempus Realty" and hang up.`;
        return `say "I am forwarding your call to ${name}" and call redirectCall with +1${contact.phoneNumbers[0]}`;
    }
}
