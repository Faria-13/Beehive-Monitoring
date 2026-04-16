#!/bin/bash
set -e

SX1302_RESET_PIN=17
CHIP=gpiochip0

case "$1" in
  start)
    echo "Resetting SX1302 using ${CHIP} line ${SX1302_RESET_PIN}"
    # Toggle: low for 100ms, then high for 100ms, then exit
    gpioset -c ${CHIP} -t 100ms,100ms,0 ${SX1302_RESET_PIN}=0
    ;;
  stop)
    exit 0
    ;;
  *)
    echo "Usage: $0 {start|stop}"
    exit 1
    ;;
esac
