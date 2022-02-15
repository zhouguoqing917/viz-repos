import React from "react"; 
export type MessageType = keyof AlertMessageIcon;

interface AlertMessageIcon {
    INFO: string;
    SUCCESS: string;
    WARNING: string;
    ERROR: string;
}

const AlertMessageIcon = {
    INFO: 'fa fa-info-circle',
    SUCCESS: 'fa fa-check-circle',
    WARNING: 'fa fa-exclamation-circle',
    ERROR: 'fa fa-error-icon'
};

export interface AlertMessageProps {
    type: MessageType;
    header: string;
}

export class AlertMessage extends React.Component<AlertMessageProps> {

    render(): React.ReactNode {
        return <div className='theia-alert-message-container'>
            <div className={`theia-${this.props.type.toLowerCase()}-alert`}>
                <div className='theia-message-header'>
                    <i className={AlertMessageIcon[this.props.type]}></i>&nbsp;
                    {this.props.header}
                </div>
                <div className='theia-message-content'>{this.props.children}</div>
            </div>
        </div>;
    }

}
