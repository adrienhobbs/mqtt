import React, { Component } from 'react';
import './App.css';
import AWSIoTData from 'aws-iot-device-sdk'
import AWS from 'aws-sdk'

const awsConfiguration = {
  poolId: 'us-east-1:a53189af-9503-4b72-ae87-cef0214ef280',
  host: 'a3uyh7gqpjdvg8.iot.us-east-1.amazonaws.com', 
  region: 'us-east-1'
};

const thingId = "esp32_111C08" // somehows store this with a username so it can be dynamic??
const updateTopic = `$aws/things/${thingId}/shadow/update`
const stateUpdatedTopic = `$aws/things/${thingId}/shadow/update/documents`
const getTopic = `$aws/things/${thingId}/shadow/get`
const getAcceptedTopic = `$aws/things/${thingId}/shadow/get/accepted`
const clientId = 'kegbot' + (Math.floor((Math.random() * 100000) + 1));

const LiveScale = function(Component, config) {
  return class extends Component {

    state = {
      weight: 0,
      temperature: 0,
      pouring: false
    }

    constructor () {
      super();
      AWS.config.region = config.region;
      AWS.config.credentials = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: config.poolId
      });
      this.mqttClient = this.createMqttClient()
    }

    createMqttClient() {
      return AWSIoTData.device({
        region: AWS.config.region,
        host: config.host,
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
        this.mqttClient.subscribe(updateTopic)
        this.mqttClient.subscribe(stateUpdatedTopic)
        this.mqttClient.subscribe(getAcceptedTopic)
        this.mqttClient.publish(getTopic)
      })

      this.mqttClient.on('message', (topic, payload) => {
        const parsedPayload = JSON.parse(payload.toString())
        if (topic === getAcceptedTopic) {
          this.setState(parsedPayload.state.reported)
        } else if (topic === stateUpdatedTopic) {
          this.setState({...parsedPayload.current.state.reported, pouring: true})

          if (this.timeoutId) {
            clearTimeout(this.timeoutId);
          }

          this.timeoutId = setTimeout(() => {
            this.setState({pouring: false})
          }, 1000)

        }
      })
    }

    tareScale = () => {
      this.mqttClient.publish(updateTopic, JSON.stringify({state: {desired: {tare: true}}}), (err) => {
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

  componentWillReceiveProps(nextProps) {
    console.log(nextProps)
  }

  render() {
    const {weight, temperature, tareScale, pouring} = this.props
    return (
      <div className="App">
        <div className="weight">
          {pouring && 'pouring'}
          {weight >= 0.5 ? weight : 0}<span>lbs</span> <br />
          {temperature}<sup>°</sup>
        </div>
        <button onClick={tareScale}>tare scale</button>
      </div>
    );
  }
}

export default LiveScale(App, awsConfiguration);
