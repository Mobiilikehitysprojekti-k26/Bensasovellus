import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import React, { useState } from 'react'
import MapView, { Region, Marker } from 'react-native-maps'

interface MapProps {
    region: Region
}

const Map = ({ region }: MapProps) => {
    const [mapType, setMapType] = useState<'standard' | 'hybrid'>('standard')
    const toggleMapType = () => {
        setMapType(mapType === 'standard' ? 'hybrid' : 'standard');
    }

    return (
        <>
            <MapView
                style={styles.map}
                region={region}
                mapType={mapType}
            >
                <Marker
                    coordinate={{
                        latitude: region.latitude,
                        longitude: region.longitude
                    }}
                    title='Your location'
                    description='You are here'
                    pinColor='red'
                />
            </MapView>
            <TouchableOpacity
                style={styles.mapTypeButton}
                onPress={toggleMapType}
                activeOpacity={0.8}
            >
                <Text style={styles.mapTypeIcon}>
                    {mapType === 'standard' ? '🗺️ ' : '🛰️ '}
                </Text>
                <Text style={styles.mapTypeText}>
                    {mapType === 'standard' ? 'MAP' : 'SAT'}
                </Text>
            </TouchableOpacity>
        </>
    )
}

const styles = StyleSheet.create({
    map: {
        flex: 1,
        width: '100%',
        height: '100%'
    },
    mapTypeButton: {
        position: 'absolute',
        top: 60,
        right: 20,
        backgroundColor: 'white',
        borderRadius: 25,
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        minWidth: 50,
        minHeight: 50,
    },
    mapTypeIcon: {
        fontSize: 18,
        marginBottom: 2,
    },
    mapTypeText: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#333'
    }
})

export default Map