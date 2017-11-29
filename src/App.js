import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import AWSIoTData from 'aws-iot-device-sdk'
import AWSConfig from './aws-config'
import AWS from 'aws-sdk'

const topic = '/devices/#'
const clientId = 'mqtt-explorer-' + (Math.floor((Math.random() * 100000) + 1));


const LiveScale = function(Component, config) {
  return class extends Component {

    state = {
      weight: 0,
      temperature: 0
    }

    constructor () {
      super();
      AWS.config.region = AWSConfig.region;
      AWS.config.credentials = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: AWSConfig.poolId
      });
      this.mqttClient = this.createMqttClient()
    }

    createMqttClient() {
      return AWSIoTData.device({
        region: AWS.config.region,
        host: AWSConfig.host,
        clientId: clientId,
        protocol: 'wss',
        maximumReconnectTimeMs: 8000,
        debug: true,
        accessKeyId: '',
        secretKey: '',
        sessionToken: ''
      }); }

    setupCognito() {
      const cognitoIdentity = new AWS.CognitoIdentity();

      AWS.config.credentials.get((err, data) => {
        if (!err) {
          console.log('retrieved identity: ' + AWS.config.credentials.identityId);
          const params = {
            IdentityId: AWS.config.credentials.identityId
          };

          cognitoIdentity.getCredentialsForIdentity(params, (err, data) => {
            if (!err) {
              this.mqttClient.updateWebSocketCredentials(
                data.Credentials.AccessKeyId,
                data.Credentials.SecretKey,
                data.Credentials.SessionToken
              );
            } else {
              console.log('error retrieving credentials: ' + err);
            }
          });
        } else {
          console.log('error retrieving identity:' + err);
        }
      });
    }

    componentDidMount() {
      this.setupCognito()
      this.listenForMqttTopics()
    }

    listenForMqttTopics() {
      this.mqttClient.on('connect', () => {
        this.mqttClient.subscribe(topic)
      })

      this.mqttClient.on('message', (topic, payload) => {
        const parsedPayload = JSON.parse(payload.toString())
        this.setState({...parsedPayload})
      })
    }

    tareScale = () => {
      this.mqttClient.publish('/scale/tare', 'true', (err) => {
        console.log(err);
      })
    }

    render() {
      return (
        <Component {...this.state} tareScale={this.tareScale} />
      )
    }
  }
}

class App extends Component {
  render() {
    const {weight, temperature, tareScale} = this.props
    return (
      <div className="App">
        <div className="weight">
          {weight >= 0.5 ? weight : 0}
        </div>
        <button onClick={tareScale}>tare scale</button>
      </div>
    );
  }
}

export default LiveScale(App, {});
