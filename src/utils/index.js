// Restructure hc signal to match chaperone signal
// Temporary fix that will be removed soon with an upcoming update of holochain/client
export const presentHcSignal = hcSignal => {
  return {
    cell: {
      cell_id: hcSignal.cellId,
      role_id: 'unknown'
    },
    data: hcSignal.payload
  }
}
